import { Component, computed, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CartItem, CartItemModificador, ClienteSearch, Mesa, Order, PosService } from '@app/features/pos/services/pos-service';
import { MesasModalComponent } from '../mesas-modal/mesas-modal';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog-service';
import { ModificadorEstructurado, ModificadorOpcion, Producto, ProductoOpcion } from '@app/core/models/producto';
import { createDateTimeString, getCurrentTimeString, getTodayDateString, normalizeDateOnlyValue, normalizeDateTimeValue, normalizeOrderDateValue } from './date-time-utils';
import { DatePicker } from '@app/shared/components/date-picker/date-picker';
import { Button } from '@app/shared/components/button/button';
import { formatCurrency } from '@app/core/config/currency.config';
import { Modal } from '@app/shared/components/modal/modal';

@Component({
  selector: 'app-cart-panel',
  standalone: true,
  imports: [CommonModule, MesasModalComponent, DatePicker, Button, Modal],
  templateUrl: './cart-panel.html',
  styleUrls: ['./cart-panel.css', './cart-panel-items.css', './cart-panel-modifiers.css', './cart-panel-actions.css'],
})
export class CartPanelComponent {
  items = input<CartItem[]>([]);
  subtotal = input<number>(0);
  total = input<number>(0);
  isProcessing = input<boolean>(false);
  orderTypeInput = input<'dine-in' | 'to-go' | 'delivery'>('dine-in');
  selectedClienteInput = input<ClienteSearch | null>(null);
  selectedMesaInput = input<Mesa | null>(null);
  orderDateInput = input<string | null>(null);
  reservationDateInput = input<string | null>(null);
  stockByProductId = input<Record<number, number>>({});
  isEditing = input<boolean>(false);
  paidAmount = input<number>(0);
  remainingAmount = input<number>(0);
  hasPaymentHistory = input<boolean>(false);
  showHistoryButton = input<boolean>(false);
  isFullyPaid = input<boolean>(false);
  editingOrderIdInput = input<number | null>(null);
  orders = input<Order[]>([]);
  deletedItems = input<CartItem[]>([]);
  hasChanges = input<boolean>(false);
  operationMode = input<'pos' | 'preorden'>('pos');

  quantityChanged = output<{ itemId: number; cantidad: number }>();
  itemRemoved = output<number>();
  checkoutRequested = output<void>();
  payLaterRequested = output<void>();
  cartCleared = output<void>();
  orderTypeChanged = output<'dine-in' | 'to-go' | 'delivery'>();
  orderDateChanged = output<string | null>();
  reservationDateChanged = output<string | null>();
  clienteSelected = output<ClienteSearch | null>();
  mesaSelected = output<Mesa | null>();
  refundRequested = output<void>();
  undoChangesRequested = output<void>();
  viewHistoryRequested = output<void>();
  editRequested = output<void>();
  existingOrderSelected = output<number>();
  itemModifiersChanged = output<{ itemId: number; modificadores: CartItemModificador[] }>();
  modifierBatchApplied = output<{ itemId: number; quantity: number; modificadores: CartItemModificador[] }>();
  modifierModalClosed = output<void>();
  itemNoteChanged = output<{ itemId: number; nota: string }>();

  // Estados locales para el carrito
  orderType = signal<'dine-in' | 'to-go' | 'delivery'>('dine-in');
  selectedCliente = signal<ClienteSearch | null>(null);
  selectedMesa = signal<Mesa | null>(null);
  orderDate = signal<string | null>(null);
  orderTime = signal<string | null>(null);
  reservationDate = signal<string | null>(null);
  reservationTime = signal<string | null>(null);
  showReservationControls = signal<boolean>(false);
  showDesktopReservationEditor = signal<boolean>(false);
  showMobileDetails = signal<boolean>(false);
  showMobileActions = signal<boolean>(false);
  itemNotes = signal<Map<number, string>>(new Map());

  // Cliente quick-select
  searchQuery = signal<string>('');
  clientesResults = signal<ClienteSearch[]>([]);
  isLoadingClientes = signal<boolean>(false);
  isCreatingCliente = signal<boolean>(false);

  // Mesas modal
  openMesasModal = signal<boolean>(false);
  mesas = signal<Mesa[]>([]);

  // Modificadores por item
  modifierModalOpen = signal<boolean>(false);
  modifierModalItem = signal<CartItem | null>(null);
  draftModifiers = signal<CartItemModificador[]>([]);
  modifierBatchSize = signal<number>(1);
  modifierRemainingUnits = signal<number>(0);

  // Snapshot para detectar cambios durante edición
  private initialSnapshot = signal<{
    total: number;
    itemsHash: string;
    clienteId: number | null;
    mesaId: number | null;
    orderType: 'dine-in' | 'to-go' | 'delivery';
    orderDate: string | null;
    reservationDate: string | null;
    reservationTime: string | null;
    notesHash: string;
  } | null>(null);

  hasEdits = computed<boolean>(() => {
    const snap = this.initialSnapshot();
    if (!this.isEditing() || !snap) return false;
    // compare totals
    if (Number(this.total()) !== Number(snap.total)) return true;
    // compare items
    const currentItemsHash = JSON.stringify(this.items().map(i => ({ id: i.id, cantidad: i.cantidad, precio_unitario: i.precio_unitario, modificadores: (i.modificadores || []).map(m=>({ modificador_id: m.modificador_id, opcion_id: m.opcion_id })) })));
    if (currentItemsHash !== snap.itemsHash) return true;
    // cliente/mesa/type/date
    const clienteId = this.selectedCliente()?.id ?? null;
    if (clienteId !== snap.clienteId) return true;
    const mesaId = this.selectedMesa()?.id ?? null;
    if (mesaId !== snap.mesaId) return true;
    if (this.orderType() !== snap.orderType) return true;
    if ((this.orderDate() ?? null) !== snap.orderDate) return true;
    if ((this.reservationDate() ?? null) !== snap.reservationDate) return true;
    if ((this.reservationTime() ?? null) !== snap.reservationTime) return true;
    // notes
    const notesObj: Record<number,string> = {};
    Array.from(this.itemNotes().entries()).forEach(([k,v]) => notesObj[k] = v);
    const notesHash = JSON.stringify(notesObj);
    if (notesHash !== snap.notesHash) return true;
    return false;
  });

  shouldShowPrimaryAction = computed<boolean>(() => {
    // Always show primary when not editing
    if (!this.isEditing()) return true;

    // When editing, compute delta vs snapshot
    const snap = this.initialSnapshot();
    const delta = snap ? Number(this.total()) - Number(snap.total) : 0;

    // If delta changes amount, show primary (charge/refund)
    if (delta > 0 || delta < 0) return true;

    // If there is still a remaining amount to collect, show primary
    if (Number(this.remainingAmount()) > 0) return true;

    // Otherwise, do not show primary action (history is shown via separate button)
    return false;
  });

  // Long-press handling
  longPressTimer: any = null;
  longPressTriggered = signal<boolean>(false);
  private previousSelectedClienteId: number | null | undefined = undefined;

  constructor(private posService: PosService, private confirmDialog: ConfirmDialogService) {
    let previousReservationInput: string | null = null;
    let isReservationInitialized = false;

    effect(() => {
      this.orderType.set(this.orderTypeInput());
      this.selectedCliente.set(this.selectedClienteInput());
      this.selectedMesa.set(this.selectedMesaInput());
      const incomingDate = this.orderDateInput();
      const normalized = normalizeDateTimeValue(incomingDate);
      this.orderDate.set(normalized?.date ?? getTodayDateString());
      this.orderTime.set(normalized?.time ?? (this.isEditing() ? null : getCurrentTimeString()));

      const incomingReservation = this.reservationDateInput();
      const reservationNormalized = normalizeDateTimeValue(incomingReservation);
      this.reservationDate.set(reservationNormalized?.date ?? null);
      this.reservationTime.set(reservationNormalized?.time ?? null);

      if (!isReservationInitialized) {
        this.showReservationControls.set(Boolean(reservationNormalized));
        isReservationInitialized = true;
      } else if (previousReservationInput === null && incomingReservation !== null) {
        // Only auto-open when a reservation is newly added from the parent.
        this.showReservationControls.set(true);
      } else if (incomingReservation === null) {
        // Hide controls when the parent explicitly clears reservation data.
        this.showReservationControls.set(false);
      }

      previousReservationInput = incomingReservation;

      const nextNotes = new Map<number, string>();
      this.items().forEach((item) => {
        const note = item.nota?.trim();
        if (note) {
          nextNotes.set(item.id, note);
        }
      });
      this.itemNotes.set(nextNotes);

      const currentCliente = this.selectedClienteInput();
      const currentClienteId = currentCliente?.id ?? null;
      if (this.previousSelectedClienteId !== undefined && this.previousSelectedClienteId !== null && currentClienteId === null) {
        this.searchQuery.set('');
        this.clientesResults.set([]);
      }
      this.previousSelectedClienteId = currentClienteId;
    });

    // Capturar snapshot inicial cuando entramos en modo edición
    let wasEditing = false;
    effect(() => {
      const editing = this.isEditing();
      const orderId = this.editingOrderIdInput();
      if (editing && !wasEditing) {
        // rising edge: capture snapshot
        const itemsHash = JSON.stringify(this.items().map(i => ({ id: i.id, cantidad: i.cantidad, precio_unitario: i.precio_unitario, modificadores: (i.modificadores || []).map(m=>({ modificador_id: m.modificador_id, opcion_id: m.opcion_id })) })));
        const notesObj: Record<number,string> = {};
        Array.from(this.itemNotes().entries()).forEach(([k,v]) => notesObj[k] = v);
        this.initialSnapshot.set({
          total: Number(this.total()),
          itemsHash,
          clienteId: this.selectedCliente()?.id ?? null,
          mesaId: this.selectedMesa()?.id ?? null,
          orderType: this.orderType(),
          orderDate: this.orderDate() ?? null,
          reservationDate: this.reservationDate() ?? null,
          reservationTime: this.reservationTime() ?? null,
          notesHash: JSON.stringify(notesObj),
        });
      }
      if (!editing) {
        this.initialSnapshot.set(null);
      }
      wasEditing = editing;
    });
  }

  onChangeOrderType(type: 'dine-in' | 'to-go' | 'delivery'): void {
    if (this.longPressTriggered()) {
      // long press already handled selection
      this.longPressTriggered.set(false);
      return;
    }
    this.orderType.set(type);
    this.orderTypeChanged.emit(type);
  }

  onIncreaseQuantity(item: CartItem): void {
    if (!this.canIncreaseQuantity(item)) {
      return;
    }

    this.quantityChanged.emit({ itemId: item.id, cantidad: item.cantidad + 1 });
  }

  onDecreaseQuantity(item: CartItem): void {
    if (item.cantidad > 1) {
      this.quantityChanged.emit({ itemId: item.id, cantidad: item.cantidad - 1 });
    } else {
      this.onRemoveItem(item.id);
    }
  }

  onRemoveItem(itemId: number): void {
    this.itemRemoved.emit(itemId);
  }

  private clearSearch(): void {
    this.searchQuery.set('');
    this.clientesResults.set([]);
  }

  onCheckout(): void {
    this.clearSearch();
    this.checkoutRequested.emit();
  }

  onPrimaryAction(): void {
    const action = this.getPrimaryActionType();
    switch (action) {
      case 'checkout':
        this.onCheckout();
        break;
      case 'refund':
        this.onRefundRequested();
        break;
      case 'history':
        this.onViewHistory();
        break;
      case 'edit':
        this.onEditAction();
        break;
      default:
        this.onCheckout();
    }
  }

  onViewHistory(): void {
    this.viewHistoryRequested.emit();
  }

  onEditAction(): void {
    this.editRequested.emit();
  }

  onUndoChanges(): void {
    this.undoChangesRequested.emit();
  }

  onRefundRequested(): void {
    this.refundRequested.emit();
  }

  onPayLater(): void {
    this.clearSearch();
    this.payLaterRequested.emit();
  }

  selectExistingOrder(order: Order): void {
    if (!order?.id) {
      return;
    }
    this.searchQuery.set('');
    this.clientesResults.set([]);
    this.existingOrderSelected.emit(order.id);
  }

  getPendingOrderRemainingAmount(order: Order): number {
    if (typeof order.saldo_pendiente === 'number') {
      return Math.max(0, order.saldo_pendiente);
    }
    const paid = (order.pagos || []).reduce((sum, pago) => sum + parseFloat(pago.monto_pagado.toString()), 0);
    return Math.max(0, Number(order.total) - paid);
  }

  private getCurrentBalance(): number {
    const total = Number(this.total());
    const paid = Number(this.paidAmount());
    const balance = total - paid;
    return Math.round((balance + Number.EPSILON) * 100) / 100;
  }

  getPrimaryActionLabel(): string {
    if (this.operationMode() === 'preorden') return 'Guardar preorden';
    if (!this.isEditing()) {
      return 'Cobrar';
    }

    if (this.isEditing() && Number(this.remainingAmount()) === 0 && !this.hasEdits()) {
      return 'Ver historial';
    }

    const balance = this.getCurrentBalance();
    if (balance > 0) {
      return `Cobrar ${this.formatPrice(balance)}`;
    }
    if (balance < 0) {
      return `Devolver ${this.formatPrice(Math.abs(balance))}`;
    }

    if (this.hasEdits()) return 'Guardar cambios';
    if (this.showHistoryButton()) return 'Ver historial';
    return 'Guardar cambios';
  }

  getPrimaryActionType(): 'checkout' | 'refund' | 'history' | 'edit' {
    if (!this.isEditing()) {
      return 'checkout';
    }

    if (this.isEditing() && Number(this.remainingAmount()) === 0 && !this.hasEdits()) {
      return 'history';
    }

    const balance = this.getCurrentBalance();
    if (balance > 0) return 'checkout';
    if (balance < 0) return 'refund';

    if (this.hasEdits()) return 'edit';
    if (this.showHistoryButton()) return 'history';
    return 'edit';
  }

  shouldShowPayLater(): boolean {
    return this.operationMode() === 'pos' && !this.isEditing();
  }

  showExtraHistoryButton(): boolean {
    // Show history button by default during edit mode
    return this.isEditing();
  }

  shouldShowEditOrderButton(): boolean {
    return this.isEditing() && this.hasEdits() && this.getPrimaryActionType() !== 'edit';
  }

  getEditOrderButtonLabel(): string {
    if (!this.isEditing()) {
      return 'Solo editar orden';
    }
    return 'Guardar cambios';
  }

  private hasMeaningfulOrderEdits(): boolean {
    return this.isEditing() && this.items().length > 0;
  }

  orderSuggestions = computed<Order[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query || !Array.isArray(this.orders()) || this.orders().length === 0) {
      return [];
    }

    const today = getTodayDateString();

    return this.orders().filter((orden) => {
      const fecha = normalizeOrderDateValue(orden.fecha_orden);
      if (!fecha || fecha !== today) {
        return false;
      }

      const orderNumber = orden.numero_orden?.toString() || orden.id.toString();
      const clienteName = orden.cliente_nombre?.toLowerCase() || '';
      const mesaNumber = orden.mesa?.numero?.toString() || '';
      const remaining = this.getPendingOrderRemainingAmount(orden).toString();

      return [orderNumber, clienteName, mesaNumber, remaining].some((value) =>
        value.toLowerCase().includes(query)
      );
    });
  });

  onCancelOrder(): void {
    this.confirmDialog.confirm({
      title: 'Cancelar orden',
      message: '¿Estás seguro de cancelar esta orden? Esta acción no se puede deshacer.',
      confirmText: 'Cancelar orden',
      confirmColor: 'danger',
    }).subscribe((result) => {
      if (result) {
        this.itemNotes.set(new Map());
        this.orderType.set('dine-in');
        this.selectedCliente.set(null);
        this.selectedMesa.set(null);
        this.orderDate.set(null);
        this.orderTime.set(null);
        this.reservationDate.set(null);
        this.reservationTime.set(null);
        this.showReservationControls.set(false);
        this.orderDateChanged.emit(null);
        this.reservationDateChanged.emit(null);
        this.searchQuery.set('');
        this.clientesResults.set([]);
        this.clienteSelected.emit(null);
        this.mesaSelected.emit(null);
        this.orderTypeChanged.emit('dine-in');
        this.cartCleared.emit();
      }
    });
  }

  getItemSubtotal(item: CartItem): number {
    const modificadoresExtra = (item.modificadores || []).reduce(
      (sum, mod) => sum + mod.precio_extra,
      0
    );
    return (item.precio_unitario + modificadoresExtra) * item.cantidad;
  }

  canIncreaseQuantity(item: CartItem): boolean {
    if (this.isProcessing()) {
      return false;
    }

    if (!item.producto?.maneja_stock) {
      return true;
    }

    const availableStock = this.stockByProductId()[item.producto.id];
    if (typeof availableStock !== 'number' || availableStock <= 0) {
      return false;
    }

    return item.cantidad < availableStock;
  }

  hasProductModifiers(item: CartItem): boolean {
    const producto = item.producto as any;
    const modifiers = (producto?.modificadores || producto?.modificadores_estructurados || []) as ModificadorEstructurado[];
    return Array.isArray(modifiers) && modifiers.some((group) => (group.opciones || []).some((option) => option.activo !== false));
  }

  getOrderDateValue(): string {
    return this.orderDate() ?? getTodayDateString();
  }

  getOrderDateInputValue(): string {
    const dateValue = this.orderDate() ?? getTodayDateString();
    if (!this.isEditing()) {
      return dateValue;
    }

    const timeValue = this.orderTime() ?? '';
    return timeValue ? `${dateValue}T${timeValue}` : dateValue;
  }

  getOrderTimeValue(): string {
    return this.orderTime() ?? '';
  }

  getReservationDateValue(): string {
    return this.reservationDate() ?? getTodayDateString();
  }

  getReservationTimeValue(): string {
    return this.reservationTime() ?? '';
  }

  clearOrderTime(): void {
    this.orderTime.set(null);
    this.emitOrderDateTime();
  }

  clearReservationTime(): void {
    this.reservationTime.set(null);
    this.emitReservationDateTime();
  }

  addMinutesToOrderDate(minutes: number): void {
    const now = new Date();
    const calculated = new Date(now.getTime() + minutes * 60000);
    const nextTime = this.formatTimeOnly(calculated);
    const dateValue = this.orderDate() ?? getTodayDateString();
    this.orderTime.set(nextTime);
    this.orderDate.set(dateValue);
    this.emitOrderDateTime();
  }

  addMinutesToReservationDate(minutes: number): void {
    const calculated = new Date(new Date().getTime() + minutes * 60000);
    const nextTime = this.formatTimeOnly(calculated);
    const dateValue = this.reservationDate() ?? this.formatDateOnly(calculated);
    this.reservationTime.set(nextTime);
    this.reservationDate.set(dateValue);
    this.emitReservationDateTime();
    this.showDesktopReservationEditor.set(false);
  }

  toggleReservationControls(): void {
    if (this.showReservationControls()) {
      return;
    }

    this.showReservationControls.set(true);
    this.showDesktopReservationEditor.set(true);
    if (!this.reservationDate() || !this.reservationTime()) {
      this.addMinutesToReservationDate(15);
      return;
    }
    this.emitReservationDateTime();
  }

  toggleDesktopReservationEditor(): void {
    this.showDesktopReservationEditor.update(open => !open);
  }

  confirmClearReservation(): void {
    this.confirmDialog.confirm({
      title: 'Cancelar preorden',
      message: 'La orden dejará de estar programada. Puedes volver a programarla cuando lo necesites.',
      confirmText: 'Cancelar preorden',
      confirmColor: 'danger',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.showReservationControls.set(false);
      this.showDesktopReservationEditor.set(false);
      this.reservationDate.set(null);
      this.reservationTime.set(null);
      this.emitReservationDateTime();
    });
  }

  hasReservationSummary(): boolean {
    return Boolean(this.reservationDate() && this.reservationTime());
  }

  getReservationSummaryText(): string {
    const dateValue = this.reservationDate();
    const timeValue = this.reservationTime();
    if (!dateValue || !timeValue) {
      return '';
    }

    return this.formatDateTimeLabel(dateValue, timeValue) || `${dateValue} ${timeValue.substring(0, 5)}`;
  }

  private formatDateTimeLabel(dateValue: string, timeValue: string): string | null {
    const normalizedTime = timeValue.length === 5 ? `${timeValue}:00` : timeValue;
    const dateTimeValue = `${dateValue}T${normalizedTime}`;
    const parsed = new Date(dateTimeValue);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
  }

  formatPrice(price: number): string {
    return formatCurrency(price);
  }

  toggleMobileDetails(): void {
    this.showMobileDetails.update(value => !value);
  }

  toggleMobileActions(): void {
    this.showMobileActions.update(value => !value);
  }

  getMobileOrderSummary(): string {
    const mesa = this.selectedMesa()?.numero;
    const cliente = this.selectedCliente()?.nombre;

    if (mesa && cliente) return `Mesa ${mesa} · ${cliente}`;
    if (mesa) return `Mesa ${mesa}`;
    if (cliente) return cliente;

    return this.orderType() === 'delivery'
      ? 'Delivery'
      : this.orderType() === 'to-go'
        ? 'Para llevar'
        : 'Sin cliente ni mesa';
  }

  // ================= CLIENTE =================
  onSearchCliente(query: string): void {
    this.searchQuery.set(query.trim());
    if (!query.trim()) {
      this.clientesResults.set([]);
      return;
    }

    this.isLoadingClientes.set(true);
    this.posService.buscarClientes(query.trim()).subscribe({
      next: (c) => this.clientesResults.set(c),
      error: () => this.clientesResults.set([]),
      complete: () => this.isLoadingClientes.set(false),
    });
  }

  selectCliente(cliente: ClienteSearch): void {
    this.selectedCliente.set(cliente);
    this.clearSearch();
    this.clienteSelected.emit(cliente);
  }

  removeCliente(): void {
    this.selectedCliente.set(null);
    this.searchQuery.set('');
    this.clientesResults.set([]);
    this.clienteSelected.emit(null);
  }

  onCreateCliente(): void {
    const nombre = this.searchQuery().trim();
    if (!nombre) return;
    this.isCreatingCliente.set(true);
    this.posService.crearCliente(nombre).subscribe({
      next: (cliente) => {
        this.selectCliente(cliente);
      },
      error: () => { },
      complete: () => this.isCreatingCliente.set(false),
    });
  }

  // ================= MESAS / LONG PRESS =================
  startLongPress(): void {
    this.longPressTimer = window.setTimeout(() => {
      this.longPressTriggered.set(true);
      this.orderType.set('dine-in');
      this.orderTypeChanged.emit('dine-in');
      this.openMesasModal.set(true);
      // fetch mesas when opening
      this.posService.obtenerMesas().subscribe({
        next: (ms) => this.mesas.set(ms || []),
        error: () => this.mesas.set([]),
      });
    }, 300);
  }

  stopLongPress(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  onMesaChosen(mesa: Mesa): void {
    this.selectedMesa.set(mesa);
    this.mesaSelected.emit(mesa);
    this.openMesasModal.set(false);
  }

  clearMesa(): void {
    this.selectedMesa.set(null);
    this.mesaSelected.emit(null);
  }

  openModifierModal(item: CartItem): void {
    this.modifierModalItem.set(item);
    this.draftModifiers.set((item.modificadores || []).map(mod => ({ ...mod })));
    this.modifierBatchSize.set(1);
    this.modifierRemainingUnits.set(Math.max(1, item.cantidad));
    this.modifierModalOpen.set(true);
  }

  closeModifierModal(): void {
    this.modifierModalOpen.set(false);
    this.modifierModalItem.set(null);
    this.draftModifiers.set([]);
    this.modifierBatchSize.set(1);
    this.modifierRemainingUnits.set(0);
    this.modifierModalClosed.emit();
  }

  // getModifierGroups(producto: Producto): ModificadorEstructurado[] {
  //   console.log('Producto:', producto);
  //   return producto?.modificadores || [];
  // }
  modifierGroups = computed<ModificadorEstructurado[]>(() => {
    const item = this.modifierModalItem();
    const groups = ((item?.producto as any)?.modificadores || (item?.producto as any)?.modificadores_estructurados || []) as ModificadorEstructurado[];

    return groups
      .map((group) => ({
        ...group,
        opciones: (group.opciones || []).filter((option) => option.activo !== false),
      }))
      .filter((group) => (group.opciones || []).length > 0);
  });

  getDefaultOptions(group: ModificadorEstructurado): ModificadorOpcion[] {
    return (group.opciones || []).filter((option) => option.predeterminado);
  }

  getAdditionalOptions(group: ModificadorEstructurado): ModificadorOpcion[] {
    return (group.opciones || []).filter((option) => !option.predeterminado);
  }

  hasDefaultOptions(group: ModificadorEstructurado): boolean {
    return this.getDefaultOptions(group).length > 0;
  }

  hasAdditionalOptions(group: ModificadorEstructurado): boolean {
    return this.getAdditionalOptions(group).length > 0;
  }

  increaseModifierBatchSize(): void {
    const max = this.modifierRemainingUnits();
    this.modifierBatchSize.set(Math.min(max, this.modifierBatchSize() + 1));
  }

  decreaseModifierBatchSize(): void {
    this.modifierBatchSize.set(Math.max(1, this.modifierBatchSize() - 1));
  }

  getModifierActionLabel(): string {
    return this.modifierRemainingUnits() > this.modifierBatchSize() ? 'Siguiente' : 'Terminar';
  }

  restoreDefaultSelections(group: ModificadorEstructurado): void {
    const modifierId = group.id;
    const defaults = this.getDefaultOptions(group);
    const current = this.draftModifiers();
    const filtered = current.filter((mod) => mod.modificador_id !== modifierId);
    const restored = defaults.map((option) => ({
      modificador_id: modifierId,
      opcion_id: option.id,
      opcion_nombre: option.nombre,
      precio_extra: option.precio_extra,
    }));
    this.draftModifiers.set([...filtered, ...restored]);
  }

  selectAllOptions(group: ModificadorEstructurado, options: ModificadorOpcion[], select: boolean): void {
    const modifierId = group.id;
    const current = this.draftModifiers();
    const selectionsForThisGroup = current.filter((mod) => mod.modificador_id === modifierId);
    const otherSelections = current.filter((mod) => mod.modificador_id !== modifierId);
    const optionIdsToAffect = new Set(options.map((option) => option.id));

    if (!select) {
      const remainingSelections = selectionsForThisGroup.filter((mod) => !optionIdsToAffect.has(mod.opcion_id));
      this.draftModifiers.set([...otherSelections, ...remainingSelections]);
      return;
    }

    const selectedOptionIds = new Set(selectionsForThisGroup.map((mod) => mod.opcion_id));
    const selected = options
      .filter((option) => !selectedOptionIds.has(option.id))
      .map((option) => ({
        modificador_id: modifierId,
        opcion_id: option.id,
        opcion_nombre: option.nombre,
        precio_extra: option.precio_extra,
      }));

    this.draftModifiers.set([...otherSelections, ...selectionsForThisGroup, ...selected]);
  }

  areAllOptionsSelected(group: ModificadorEstructurado, options: ModificadorOpcion[]): boolean {
    return options.length > 0 && options.every((option) => this.isModifierSelected(group, option));
  }

  toggleAllOptions(group: ModificadorEstructurado, options: ModificadorOpcion[]): void {
    this.selectAllOptions(group, options, !this.areAllOptionsSelected(group, options));
  }

  isModifierSelected(group: ModificadorEstructurado, option: ModificadorOpcion): boolean {
    //const modifierId = group.modificador_id;
    //return this.draftModifiers().some((mod) => mod.modificador_id === modifierId && mod.opcion_id === option.id);
    return this.draftModifiers().some(
      (mod) => mod.modificador_id === group.id && mod.opcion_id === option.id
    );;
  }

  toggleModifierOption(group: ModificadorEstructurado, option: ModificadorOpcion): void {
    //const modifierId = group.modificador_id;
    const modifierId = group.id;
    const newModifier: CartItemModificador = {
      modificador_id: modifierId,
      opcion_id: option.id,
      opcion_nombre: option.nombre,
      precio_extra: option.precio_extra,
    };

    const current = this.draftModifiers();
    //const isMultiple = group.modificador?.tipo === 'multiple';
    const isMultiple = group.tipo === 'multiple';
    const alreadySelected = current.some(
      (mod) => mod.modificador_id === modifierId && mod.opcion_id === option.id
    );

    if (alreadySelected) {
      this.draftModifiers.set(current.filter((mod) => !(mod.modificador_id === modifierId && mod.opcion_id === option.id)));
      return;
    }

    if (!isMultiple) {
      const withoutGroup = current.filter((mod) => mod.modificador_id !== modifierId);
      this.draftModifiers.set([...withoutGroup, newModifier]);
      return;
    }

    //const withoutGroup = current.filter((mod) => mod.modificador_id !== modifierId);
    //this.draftModifiers.set([...withoutGroup, newModifier]);
    this.draftModifiers.set([...current, newModifier]);
  }

  saveModifierSelection(): void {
    const item = this.modifierModalItem();
    if (!item) {
      return;
    }

    const selectedModifiers = this.draftModifiers().map((mod) => ({ ...mod }));
    const currentBatchSize = this.modifierBatchSize();
    const remainingUnits = this.modifierRemainingUnits() - currentBatchSize;

    this.modifierBatchApplied.emit({
      itemId: item.id,
      quantity: currentBatchSize,
      modificadores: selectedModifiers,
    });

    if (remainingUnits <= 0) {
      this.closeModifierModal();
      return;
    }

    this.modifierRemainingUnits.set(remainingUnits);
    this.modifierBatchSize.set(1);
  }

  getItemNote(itemId: number): string {
    return this.itemNotes().get(itemId) || '';
  }

  setItemNote(itemId: number, note: string): void {
    const newNotes = new Map(this.itemNotes());
    if (note.trim()) {
      newNotes.set(itemId, note);
    } else {
      newNotes.delete(itemId);
    }
    this.itemNotes.set(newNotes);
    this.itemNoteChanged.emit({ itemId, nota: note.trim() });
  }

  onOrderDateChange(value: string): void {
    const parsed = normalizeDateTimeValue(value || null);
    if (parsed) {
      this.orderDate.set(parsed.date);
      if (this.isEditing()) {
        this.orderTime.set(parsed.time ?? null);
      } else {
        this.orderTime.set(this.orderTime() ?? getCurrentTimeString());
      }
    } else {
      this.orderDate.set(getTodayDateString());
      this.orderTime.set(this.isEditing() ? null : getCurrentTimeString());
    }
    this.emitOrderDateTime();
  }

  onOrderTimeChange(value: string): void {
    const timeValue = value ? value.trim() : null;
    this.orderTime.set(timeValue);
    this.emitOrderDateTime();
  }

  onReservationDateChange(value: string): void {
    const parsed = normalizeDateTimeValue(value || null);
    if (parsed) {
      this.reservationDate.set(parsed.date);
      this.reservationTime.set(parsed.time ?? null);
    } else {
      this.reservationDate.set(getTodayDateString());
      this.reservationTime.set(null);
    }
    this.emitReservationDateTime();
    if (this.reservationDate() && this.reservationTime()) {
      this.showDesktopReservationEditor.set(false);
    }
  }

  onReservationTimeChange(value: string): void {
    const timeValue = value ? value.trim() : null;
    this.reservationTime.set(timeValue);
    this.emitReservationDateTime();
    if (this.reservationDate() && timeValue) {
      this.showDesktopReservationEditor.set(false);
    }
  }

  getProductImage(producto: any): string {
    return producto.imagen_url || '/images/no-image.png';
  }

  private emitOrderDateTime(): void {
    const dateValue = this.orderDate() ?? getTodayDateString();
    const timeValue = this.orderTime();
    const payload = createDateTimeString(dateValue, timeValue);
    this.orderDateChanged.emit(payload);
  }

  private emitReservationDateTime(): void {
    const dateValue = this.reservationDate();
    const timeValue = this.reservationTime();
    if (!dateValue || !timeValue) {
      this.reservationDateChanged.emit(null);
      return;
    }

    const payload = createDateTimeString(dateValue, timeValue);
    this.reservationDateChanged.emit(payload);
  }

  private formatTimeOnly(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  private formatDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  trackByItem = (index: number, item: CartItem) => item.id;
}
