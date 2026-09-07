import { agruparCarrito } from '../../services/cart-groups';
import { Component, computed, untracked, DestroyRef, effect, ElementRef, inject, input, output, signal } from '@angular/core';
import { ConfiguracionService } from '@app/core/services/configuracion-service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, timer, exhaustMap, catchError } from 'rxjs';
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
import { ToastrService } from 'ngx-toastr';
import { Icon } from '@app/shared/components/icon/icon';

@Component({
  selector: 'app-cart-panel',
  standalone: true,
  imports: [CommonModule, MesasModalComponent, DatePicker, Button, Modal, Icon],
  templateUrl: './cart-panel.html',
  styleUrls: ['./cart-panel.css', './cart-panel-items.css', './cart-panel-modifiers.css', './cart-panel-actions.css'],
})
export class CartPanelComponent {
  readonly configuracion = inject(ConfiguracionService);
  private readonly configuracionSync = timer(0, 15000).pipe(
    exhaustMap(() => this.configuracion.cargar().pipe(catchError(() => EMPTY))),
    takeUntilDestroyed(inject(DestroyRef))
  ).subscribe();
  private readonly toastr = inject(ToastrService);
  private readonly hostElement = inject(ElementRef<HTMLElement>);
  items = input<CartItem[]>([]);
  itemsVisuales = computed(() => agruparCarrito(this.items()));
  private modifierGroupIds: number[] = [];

  private lineasDelGrupo(item: CartItem): CartItem[] {
    return this.itemsVisuales().find(grupo => grupo.id === item.id)?.lineas ?? [item];
  }
  subtotal = input<number>(0);
  total = input<number>(0);
  isProcessing = input<boolean>(false);
  orderTypeInput = input<'dine-in' | 'to-go' | 'delivery'>('dine-in');
  selectedClienteInput = input<ClienteSearch | null>(null);
  selectedMesaInput = input<Mesa | null>(null);
  orderDateInput = input<string | null>(null);
  reservationDateInput = input<string | null>(null);
  stockByProductId = input<Record<number, number>>({});
  modifierStockCredits = input<Record<number, number>>({});
  isEditing = input<boolean>(false);
  paidAmount = input<number>(0);
  remainingAmount = input<number>(0);
  hasPaymentHistory = input<boolean>(false);
  showHistoryButton = input<boolean>(false);
  isFullyPaid = input<boolean>(false);
  editingOrderIdInput = input<number | null>(null);
  panelResetVersion = input<number>(0);
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
  modifierModalClosed = output<{ itemId: number; completed: boolean }>();
  modifierDraftReservationChanged = output<{
    original: CartItemModificador[];
    draft: CartItemModificador[];
    quantity: number;
  } | null>();
  modifierReservationRequested = output<{
    reservation: { original: CartItemModificador[]; draft: CartItemModificador[]; quantity: number };
    accept: () => void;
    reject: (message: string) => void;
  }>();
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
  openItemNotes = signal<Set<number>>(new Set());
  recentlyAddedItemId = signal<number | null>(null);
  modifierCopySourceId = signal<number | null>(null);
  modifierCopyTargetId = signal<number | null>(null);
  modifierCopyActive = signal<boolean>(false);
  modifierCopyPosition = signal({ x: 0, y: 0 });
  private modifierCopyTimer: ReturnType<typeof setTimeout> | null = null;
  private modifierCopyPointerId: number | null = null;
  private modifierCopyOrigin = { x: 0, y: 0 };
  private modifierCopyCaptureElement: HTMLElement | null = null;

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
  modifierTotalUnits = signal<number>(0);
  modifierSelectionError = signal<string | null>(null);
  modifierProgressMessage = signal<string>('');
  modifierReservationPending = signal(false);
  private confirmedDraftModifiers: CartItemModificador[] = [];
  private queuedDraftModifiers: CartItemModificador[] | null = null;
  private modifierReplacementIndex = new Map<number, number>();
  private modifierProgressTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly draftReservationEffect = effect(() => {
    const item = this.modifierModalItem();
    if (!this.modifierModalOpen() || !item) {
      this.modifierDraftReservationChanged.emit(null);
      return;
    }
    this.modifierDraftReservationChanged.emit({
      original: (item.modificadores || []).map(mod => ({ ...mod })),
      draft: this.draftModifiers().map(mod => ({ ...mod })),
      quantity: this.modifierBatchSize(),
    });
  });

  private requestDraftModifiers(next: CartItemModificador[]): void {
    const item = this.modifierModalItem();
    if (!item) return;

    const optimisticDraft = next.map(mod => ({ ...mod }));
    const previousDraft = this.draftModifiers();
    this.draftModifiers.set(optimisticDraft);
    this.modifierSelectionError.set(null);

    // Las opciones sin inventario son elecciones normales: no necesitan tocar
    // el servidor ni esperar una reserva entre cajas.
    if (!this.hasStockModifierChange(item, previousDraft, optimisticDraft)) {
      this.confirmedDraftModifiers = this.mergeNonStockModifiers(
        item,
        this.confirmedDraftModifiers,
        optimisticDraft,
      );
      return;
    }

    if (this.modifierReservationPending()) {
      this.queuedDraftModifiers = optimisticDraft;
      return;
    }

    this.sendDraftReservation(optimisticDraft);
  }

  private sendDraftReservation(next: CartItemModificador[]): void {
    const item = this.modifierModalItem();
    if (!item) return;
    this.modifierReservationPending.set(true);
    this.modifierReservationRequested.emit({
      reservation: {
        original: (item.modificadores || []).map(mod => ({ ...mod })),
        draft: next.map(mod => ({ ...mod })),
        quantity: this.modifierBatchSize(),
      },
      accept: () => {
        this.confirmedDraftModifiers = this.mergeNonStockModifiers(
          item,
          next,
          this.draftModifiers(),
        );
        this.modifierReservationPending.set(false);
        this.modifierSelectionError.set(null);
        const queued = this.queuedDraftModifiers;
        this.queuedDraftModifiers = null;
        if (queued) this.sendDraftReservation(queued);
      },
      reject: message => {
        this.queuedDraftModifiers = null;
        this.draftModifiers.set(this.mergeNonStockModifiers(
          item,
          this.confirmedDraftModifiers,
          this.draftModifiers(),
        ));
        this.modifierReservationPending.set(false);
        this.modifierSelectionError.set(message);
      },
    });
  }

  private hasStockModifierChange(
    item: CartItem,
    previous: CartItemModificador[],
    next: CartItemModificador[],
  ): boolean {
    const countStockOptions = (modifiers: CartItemModificador[]) => modifiers.reduce((counts, modifier) => {
      if (!this.optionForItem(item, modifier.opcion_id)?.maneja_stock) return counts;
      counts.set(modifier.opcion_id, (counts.get(modifier.opcion_id) || 0) + 1);
      return counts;
    }, new Map<number, number>());
    const before = countStockOptions(previous);
    const after = countStockOptions(next);
    return [...new Set([...before.keys(), ...after.keys()])]
      .some(optionId => (before.get(optionId) || 0) !== (after.get(optionId) || 0));
  }

  private mergeNonStockModifiers(
    item: CartItem,
    stockSource: CartItemModificador[],
    nonStockSource: CartItemModificador[],
  ): CartItemModificador[] {
    return [
      ...stockSource.filter(modifier => this.optionForItem(item, modifier.opcion_id)?.maneja_stock),
      ...nonStockSource.filter(modifier => !this.optionForItem(item, modifier.opcion_id)?.maneja_stock),
    ].map(modifier => ({ ...modifier }));
  }

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

    // El saldo pendiente se muestra limitado a cero, por lo que no permite
    // distinguir una orden saldada de otra con dinero pendiente de devolver.
    // El balance real sí conserva ese excedente negativo.
    if (this.getCurrentBalance() < 0) return true;

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
    let previousItemIds = new Set<number>();
    let addedItemTimer: ReturnType<typeof setTimeout> | null = null;

    effect(() => {
      this.panelResetVersion();
      this.showMobileDetails.set(false);
      this.showMobileActions.set(false);
    });

    effect(() => {
      if (this.items().length === 0) {
        this.showMobileDetails.set(false);
        this.showMobileActions.set(false);
      }
    });

    effect(() => {
      const ids = this.items().map(item => item.id);
      const addedId = previousItemIds.size > 0
        ? ids.find(id => !previousItemIds.has(id))
        : undefined;
      previousItemIds = new Set(ids);

      if (addedId === undefined) return;
      this.recentlyAddedItemId.set(addedId);
      setTimeout(() => {
        const addedElement = this.hostElement.nativeElement
          .querySelector(`[data-cart-item-id="${addedId}"]`) as HTMLElement | null;
        addedElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      if (addedItemTimer) clearTimeout(addedItemTimer);
      addedItemTimer = setTimeout(() => this.recentlyAddedItemId.set(null), 1200);
    });

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

      // Leer el destino sin suscribir este efecto a sus propias escrituras.
      const modalItem = untracked(this.modifierModalItem);
      if (modalItem) {
        const refreshedModalItem = agruparCarrito(this.items().filter(item => this.modifierGroupIds.includes(item.id)))[0];
        if (refreshedModalItem && JSON.stringify(refreshedModalItem) !== JSON.stringify(modalItem)) {
          this.modifierModalItem.set(refreshedModalItem);
        }
      }

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
      // Solo ignorar el click sintético que sigue a una pulsación larga del
      // propio botón Mesa. Nunca consumir el primer click sobre Llevar.
      this.longPressTriggered.set(false);
      if (type === 'dine-in') return;
    }
    this.orderType.set(type);
    this.orderTypeChanged.emit(type);
  }

  onIncreaseQuantity(item: CartItem): void {
    if (!this.canIncreaseQuantity(item)) {
      this.toastr.warning(this.getIncreaseStockProblem(item) || 'No hay stock suficiente para aumentar la cantidad.');
      return;
    }

    const lineas = this.lineasDelGrupo(item);
    const destino = lineas.find(linea => !linea.orden_detalle_id) ?? lineas[0];
    this.quantityChanged.emit({ itemId: destino.id, cantidad: destino.cantidad + 1 });
  }

  onDecreaseQuantity(item: CartItem): void {
    const lineas = [...this.lineasDelGrupo(item)].reverse();
    const destino = lineas.find(linea => !linea.orden_detalle_id) ?? lineas[0];
    if (destino.cantidad > 1) {
      this.quantityChanged.emit({ itemId: destino.id, cantidad: destino.cantidad - 1 });
    } else {
      this.itemRemoved.emit(destino.id);
    }
  }

  onRemoveItem(itemId: number): void {
    const grupo = this.itemsVisuales().find(item => item.id === itemId);
    for (const linea of grupo?.lineas ?? []) this.itemRemoved.emit(linea.id);
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
    if (action === 'checkout' && !this.showMobileDetails()) {
      this.showMobileDetails.set(true);
      return;
    }
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
    if (!this.showMobileDetails()) {
      this.showMobileDetails.set(true);
      return;
    }
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

    const balance = this.getCurrentBalance();
    if (balance > 0) {
      return `Cobrar ${this.formatPrice(balance)}`;
    }
    if (balance < 0) {
      return `Devolver ${this.formatPrice(Math.abs(balance))}`;
    }

    if (Number(this.remainingAmount()) === 0 && !this.hasEdits()) return 'Ver historial';

    if (this.hasEdits()) return 'Guardar cambios';
    if (this.showHistoryButton()) return 'Ver historial';
    return 'Guardar cambios';
  }

  getPrimaryActionType(): 'checkout' | 'refund' | 'history' | 'edit' {
    if (!this.isEditing()) {
      return 'checkout';
    }

    const balance = this.getCurrentBalance();
    if (balance > 0) return 'checkout';
    if (balance < 0) return 'refund';

    if (Number(this.remainingAmount()) === 0 && !this.hasEdits()) return 'history';

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

    const workDate = this.getOrderDateValue();

    return this.orders().filter((orden) => {
      const fecha = normalizeOrderDateValue(orden.fecha_orden || orden.created_at);
      if (!fecha || fecha !== workDate) {
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

    if (item.producto?.maneja_stock) {
      const availableStock = this.stockByProductId()[item.producto.id];
      if (typeof availableStock !== 'number' || availableStock <= 0 || item.cantidad >= availableStock) return false;
    }
    return !this.getModifierStockProblem(item, item.cantidad + 1);
  }

  private productModifierOptions(producto: Producto): ModificadorOpcion[] {
    const groups = (producto.modificadores || (producto as any).modificadores_estructurados || []) as ModificadorEstructurado[];
    return groups.flatMap(group => group.opciones || []);
  }

  private optionForItem(item: CartItem, opcionId: number): ModificadorOpcion | undefined {
    return this.productModifierOptions(item.producto).find(option => option.id === opcionId);
  }

  getOptionCartUsage(opcionId: number): number {
    return this.items().reduce((total, item) => total + (item.modificadores || []).filter(mod => mod.opcion_id === opcionId).length * item.cantidad, 0);
  }

  private effectiveOptionStock(option: ModificadorOpcion): number | null {
    if (option.stock_disponible == null) return null;
    return Number(option.stock_disponible) + (this.modifierStockCredits()[option.id] || 0);
  }

  getOptionAvailabilityLabel(option: ModificadorOpcion): string | null {
    const remaining = this.getOptionRemaining(option);
    if (remaining === null) return null;
    if (remaining <= 0) return 'Agotada';
    if (remaining === 1) return 'Última disponible';
    return `${remaining} disponibles`;
  }

  getOptionRemaining(option: ModificadorOpcion): number | null {
    if (option.stock_disponible == null) return null;
    let projectedUsage = this.getOptionCartUsage(option.id);
    const item = this.modifierModalItem();
    if (item) {
      const batchSize = this.modifierBatchSize();
      const previousCount = (item.modificadores || []).filter(mod => mod.opcion_id === option.id).length;
      const draftCount = this.draftModifiers().filter(mod => mod.opcion_id === option.id).length;
      projectedUsage = projectedUsage - previousCount * batchSize + draftCount * batchSize;
    }
    return Math.max(0, this.effectiveOptionStock(option)! - projectedUsage);
  }

  getItemModifierStockWarning(item: CartItem): string | null {
    const messages = [...new Set((item.modificadores || []).map(mod => {
      const option = this.optionForItem(item, mod.opcion_id);
      if (!option || option.stock_disponible == null) return null;
      const used = this.getOptionCartUsage(option.id);
      const effectiveStock = this.effectiveOptionStock(option)!;
      return used > effectiveStock ? `${option.nombre}: faltan ${used - effectiveStock}` : null;
    }).filter((message): message is string => !!message))];
    return messages.length ? `Límite de stock: ${messages.join(' · ')}` : null;
  }

  private getModifierStockProblem(item: CartItem, nextQuantity: number): string | null {
    const currentCounts = new Map<number, number>();
    (item.modificadores || []).forEach(mod => currentCounts.set(mod.opcion_id, (currentCounts.get(mod.opcion_id) || 0) + 1));
    for (const [opcionId, count] of currentCounts) {
      const option = this.optionForItem(item, opcionId);
      if (!option || option.stock_disponible == null) continue;
      const projected = this.getOptionCartUsage(opcionId) - count * item.cantidad + count * nextQuantity;
      const effectiveStock = this.effectiveOptionStock(option)!;
      if (projected > effectiveStock) return `Esta orden puede usar hasta ${effectiveStock} unidades de ${option.nombre}; el carrito usaría ${projected}.`;
    }
    return null;
  }

  private getIncreaseStockProblem(item: CartItem): string | null {
    if (item.producto?.maneja_stock && item.cantidad >= (this.stockByProductId()[item.producto.id] ?? 0)) return `No hay más stock de ${item.producto.nombre}.`;
    return this.getModifierStockProblem(item, item.cantidad + 1);
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
      this.addMinutesToReservationDate(20);
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

  isItemNoteOpen(itemId: number): boolean {
    return this.openItemNotes().has(itemId);
  }

  toggleItemNote(itemId: number): void {
    const next = new Set(this.openItemNotes());
    next.has(itemId) ? next.delete(itemId) : next.add(itemId);
    this.openItemNotes.set(next);
  }

  startModifierCopy(event: PointerEvent, item: CartItem): void {
    if (this.isProcessing() || !(item.modificadores || []).length) return;
    this.cancelModifierCopyTimer();
    this.modifierCopyPointerId = event.pointerId;
    this.modifierCopyOrigin = { x: event.clientX, y: event.clientY };
    this.modifierCopyPosition.set({ x: event.clientX, y: event.clientY });
    this.modifierCopyCaptureElement = event.currentTarget as HTMLElement;
    this.modifierCopyTimer = setTimeout(() => {
      this.modifierCopySourceId.set(item.id);
      this.modifierCopyActive.set(true);
      this.modifierCopyCaptureElement?.setPointerCapture(event.pointerId);
      if ('vibrate' in navigator) navigator.vibrate?.(35);
    }, 480);
  }

  moveModifierCopy(event: PointerEvent): void {
    if (event.pointerId !== this.modifierCopyPointerId) return;
    if (!this.modifierCopyActive()) {
      const distance = Math.hypot(
        event.clientX - this.modifierCopyOrigin.x,
        event.clientY - this.modifierCopyOrigin.y,
      );
      if (distance > 8) this.cancelModifierCopyTimer();
      return;
    }

    event.preventDefault();
    this.modifierCopyPosition.set({ x: event.clientX, y: event.clientY });
    const card = document.elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-cart-item-id]');
    const targetId = Number(card?.dataset['cartItemId']);
    const target = this.itemsVisuales().find(item => item.id === targetId);
    this.modifierCopyTargetId.set(target && this.isModifierCopyCompatible(target) ? target.id : null);
  }

  finishModifierCopy(event: PointerEvent): void {
    if (event.pointerId !== this.modifierCopyPointerId) return;
    this.cancelModifierCopyTimer();
    if (!this.modifierCopyActive()) {
      this.resetModifierCopy();
      return;
    }

    event.preventDefault();
    const source = this.itemsVisuales().find(item => item.id === this.modifierCopySourceId());
    const target = this.itemsVisuales().find(item => item.id === this.modifierCopyTargetId());
    this.resetModifierCopy();
    if (!source || !target) return;
    this.copyModifiers(source, target);
  }

  cancelModifierCopy(): void {
    this.cancelModifierCopyTimer();
    this.resetModifierCopy();
  }

  isModifierCopyCompatible(target: CartItem): boolean {
    const source = this.itemsVisuales().find(item => item.id === this.modifierCopySourceId());
    if (!source || target.id === source.id) return false;
    const copied = source.modificadores || [];
    if (!copied.length) return false;

    const groups = (target.producto.modificadores || (target.producto as any).modificadores_estructurados || []) as ModificadorEstructurado[];
    const groupById = new Map(groups.map(group => [group.id, group]));
    for (const modifier of copied) {
      const group = groupById.get(modifier.modificador_id);
      const option = group?.opciones?.find(option => option.id === modifier.opcion_id && option.activo !== false);
      if (!group || group.activo === false || !option) return false;
    }

    for (const group of groups.filter(group => group.activo !== false)) {
      const count = copied.filter(modifier => modifier.modificador_id === group.id).length;
      if (group.cantidad_requerida && count !== group.cantidad_requerida) return false;
      if (!group.cantidad_requerida && group.requerido && count === 0) return false;
      if (group.tipo === 'unico' && count > 1) return false;
    }

    const oldCounts = this.modifierCounts(target.modificadores || []);
    const copiedCounts = this.modifierCounts(copied);
    for (const [optionId, count] of copiedCounts) {
      const option = this.optionForItem(target, optionId);
      if (!option || option.stock_disponible == null) continue;
      const projected = this.getOptionCartUsage(optionId)
        - (oldCounts.get(optionId) || 0) * target.cantidad
        + count * target.cantidad;
      if (projected > this.effectiveOptionStock(option)!) return false;
    }
    return true;
  }

  isModifierCopyDestination(item: CartItem): boolean {
    return this.modifierCopyActive() && this.isModifierCopyCompatible(item);
  }

  getModifierCopyLabel(): string {
    const source = this.itemsVisuales().find(item => item.id === this.modifierCopySourceId());
    const count = source?.modificadores?.length || 0;
    return `${count} modificador${count === 1 ? '' : 'es'}`;
  }

  private copyModifiers(source: CartItem, target: CartItem): void {
    if (!this.isCopyStillCompatible(source, target)) {
      this.toastr.warning('Ese producto no admite todos los modificadores seleccionados.');
      return;
    }
    const copied = (source.modificadores || []).map(modifier => ({ ...modifier }));
    this.modifierReservationRequested.emit({
      reservation: {
        original: (target.modificadores || []).map(modifier => ({ ...modifier })),
        draft: copied,
        quantity: target.cantidad,
      },
      accept: () => {
        for (const linea of this.lineasDelGrupo(target)) this.itemModifiersChanged.emit({ itemId: linea.id, modificadores: copied });
        this.toastr.success(`Modificadores copiados a ${target.producto.nombre}.`);
      },
      reject: message => this.toastr.warning(message),
    });
  }

  private isCopyStillCompatible(source: CartItem, target: CartItem): boolean {
    this.modifierCopySourceId.set(source.id);
    const compatible = this.isModifierCopyCompatible(target);
    this.modifierCopySourceId.set(null);
    return compatible;
  }

  private modifierCounts(modifiers: CartItemModificador[]): Map<number, number> {
    const counts = new Map<number, number>();
    modifiers.forEach(modifier => counts.set(modifier.opcion_id, (counts.get(modifier.opcion_id) || 0) + 1));
    return counts;
  }

  private cancelModifierCopyTimer(): void {
    if (!this.modifierCopyTimer) return;
    clearTimeout(this.modifierCopyTimer);
    this.modifierCopyTimer = null;
  }

  private resetModifierCopy(): void {
    if (this.modifierCopyCaptureElement && this.modifierCopyPointerId !== null
      && this.modifierCopyCaptureElement.hasPointerCapture(this.modifierCopyPointerId)) {
      this.modifierCopyCaptureElement.releasePointerCapture(this.modifierCopyPointerId);
    }
    this.modifierCopyActive.set(false);
    this.modifierCopySourceId.set(null);
    this.modifierCopyTargetId.set(null);
    this.modifierCopyPointerId = null;
    this.modifierCopyCaptureElement = null;
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
    this.longPressTriggered.set(false);
    this.selectedMesa.set(mesa);
    this.mesaSelected.emit(mesa);
    this.openMesasModal.set(false);
  }

  clearMesa(): void {
    this.selectedMesa.set(null);
    this.mesaSelected.emit(null);
  }

  openModifierModal(item: CartItem): void {
    const grupo = this.itemsVisuales().find(grupo => grupo.lineas.some(linea => linea.id === item.id));
    item = grupo ?? item;
    this.modifierGroupIds = (grupo?.lineas ?? [item]).map(linea => linea.id);
    this.modifierReplacementIndex.clear();
    this.modifierModalItem.set(item);
    this.confirmedDraftModifiers = (item.modificadores || []).map(mod => ({ ...mod }));
    this.queuedDraftModifiers = null;
    this.modifierReservationPending.set(false);
    this.draftModifiers.set(this.confirmedDraftModifiers.map(mod => ({ ...mod })));
    this.modifierBatchSize.set(1);
    this.modifierRemainingUnits.set(Math.max(1, item.cantidad));
    this.modifierTotalUnits.set(Math.max(1, item.cantidad));
    this.modifierSelectionError.set(null);
    this.modifierProgressMessage.set('');
    this.modifierModalOpen.set(true);
  }

  closeModifierModal(completed = false): void {
    const itemId = this.modifierModalItem()?.id;
    if (this.modifierProgressTimer) {
      clearTimeout(this.modifierProgressTimer);
      this.modifierProgressTimer = null;
    }
    this.modifierReplacementIndex.clear();
    this.confirmedDraftModifiers = [];
    this.queuedDraftModifiers = null;
    this.modifierReservationPending.set(false);
    this.modifierModalOpen.set(false);
    this.modifierModalItem.set(null);
    this.draftModifiers.set([]);
    this.modifierBatchSize.set(1);
    this.modifierRemainingUnits.set(0);
    this.modifierTotalUnits.set(0);
    this.modifierSelectionError.set(null);
    this.modifierProgressMessage.set('');
    if (itemId != null) this.modifierModalClosed.emit({ itemId, completed });
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

  isModifierOptionAvailable(option: ModificadorOpcion): boolean {
    const remaining = this.getOptionRemaining(option);
    return remaining === null || remaining > 0 || this.draftModifiers().some(mod => mod.opcion_id === option.id);
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
    const restored = defaults.filter(option => this.isModifierOptionAvailable(option)).map((option) => ({
      modificador_id: modifierId,
      opcion_id: option.id,
      opcion_nombre: option.nombre,
      precio_extra: option.precio_extra,
    }));
    this.requestDraftModifiers([...filtered, ...restored]);
  }

  selectAllOptions(group: ModificadorEstructurado, options: ModificadorOpcion[], select: boolean): void {
    const modifierId = group.id;
    const current = this.draftModifiers();
    const selectionsForThisGroup = current.filter((mod) => mod.modificador_id === modifierId);
    const otherSelections = current.filter((mod) => mod.modificador_id !== modifierId);
    const optionIdsToAffect = new Set(options.map((option) => option.id));

    if (!select) {
      const remainingSelections = selectionsForThisGroup.filter((mod) => !optionIdsToAffect.has(mod.opcion_id));
      this.requestDraftModifiers([...otherSelections, ...remainingSelections]);
      return;
    }

    const selectedOptionIds = new Set(selectionsForThisGroup.map((mod) => mod.opcion_id));
    const selected = options
      .filter((option) => !selectedOptionIds.has(option.id) && this.isModifierOptionAvailable(option))
      .map((option) => ({
        modificador_id: modifierId,
        opcion_id: option.id,
        opcion_nombre: option.nombre,
        precio_extra: option.precio_extra,
      }));

    this.requestDraftModifiers([...otherSelections, ...selectionsForThisGroup, ...selected]);
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

  getModifierOptionQuantity(group: ModificadorEstructurado, option: ModificadorOpcion): number {
    return this.draftModifiers().filter(
      (mod) => mod.modificador_id === group.id && mod.opcion_id === option.id
    ).length;
  }

  getModifierGroupQuantity(group: ModificadorEstructurado): number {
    return this.draftModifiers().filter((mod) => mod.modificador_id === group.id).length;
  }

  toggleModifierOption(group: ModificadorEstructurado, option: ModificadorOpcion): void {
    if (!this.isModifierOptionAvailable(option)) {
      this.modifierSelectionError.set(`${option.nombre} no tiene stock disponible.`);
      return;
    }
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

    if (group.cantidad_requerida) {
      const cantidadGrupo = this.getModifierGroupQuantity(group);
      const cantidadOpcion = this.getModifierOptionQuantity(group, option);
      if (cantidadGrupo < group.cantidad_requerida) {
        const stockNecesario = (cantidadOpcion + 1) * this.modifierBatchSize();
        const effectiveStock = this.effectiveOptionStock(option);
        if (effectiveStock != null && stockNecesario > effectiveStock) {
          this.modifierSelectionError.set(`Esta orden puede usar hasta ${effectiveStock} unidades de ${option.nombre}.`);
          return;
        }
        this.modifierSelectionError.set(null);
        this.requestDraftModifiers([...current, newModifier]);
        return;
      }

      const indicesGrupo = current
        .map((mod, index) => mod.modificador_id === modifierId ? index : -1)
        .filter(index => index >= 0);
      const turno = (this.modifierReplacementIndex.get(modifierId) || 0) % indicesGrupo.length;
      const indiceAReemplazar = indicesGrupo[turno];
      const reemplazados = [...current];
      reemplazados[indiceAReemplazar] = newModifier;
      this.requestDraftModifiers(reemplazados);
      this.modifierReplacementIndex.set(modifierId, (turno + 1) % indicesGrupo.length);
      this.modifierSelectionError.set(null);
      return;
    }

    if (alreadySelected) {
      this.requestDraftModifiers(current.filter((mod) => !(mod.modificador_id === modifierId && mod.opcion_id === option.id)));
      return;
    }

    if (!isMultiple) {
      const withoutGroup = current.filter((mod) => mod.modificador_id !== modifierId);
      this.requestDraftModifiers([...withoutGroup, newModifier]);
      return;
    }

    //const withoutGroup = current.filter((mod) => mod.modificador_id !== modifierId);
    //this.draftModifiers.set([...withoutGroup, newModifier]);
    this.requestDraftModifiers([...current, newModifier]);
  }

  saveModifierSelection(): void {
    const item = this.modifierModalItem();
    if (!item) {
      return;
    }

    const exactQuantityMismatch = this.modifierGroups().find(group => group.cantidad_requerida && this.getModifierGroupQuantity(group) !== group.cantidad_requerida);
    if (exactQuantityMismatch) {
      this.modifierSelectionError.set(`Debes elegir exactamente ${exactQuantityMismatch.cantidad_requerida} en “${exactQuantityMismatch.nombre}”.`);
      return;
    }

    const requiredWithoutSelection = this.modifierGroups().find(group => !group.cantidad_requerida && group.requerido && !this.draftModifiers().some(mod => mod.modificador_id === group.id));
    if (requiredWithoutSelection) {
      this.modifierSelectionError.set(`Debes elegir una opción en “${requiredWithoutSelection.nombre}”.`);
      return;
    }

    const selectedModifiers = this.draftModifiers().map((mod) => ({ ...mod }));
    const currentBatchSize = this.modifierBatchSize();
    const itemCounts = new Map<number, number>();
    (item.modificadores || []).forEach(mod => itemCounts.set(mod.opcion_id, (itemCounts.get(mod.opcion_id) || 0) + 1));
    const selectedCounts = new Map<number, number>();
    selectedModifiers.forEach(mod => selectedCounts.set(mod.opcion_id, (selectedCounts.get(mod.opcion_id) || 0) + 1));
    for (const [opcionId, selectedCount] of selectedCounts) {
      const option = this.optionForItem(item, opcionId);
      if (!option || option.stock_disponible == null) continue;
      const projected = this.getOptionCartUsage(opcionId) - (itemCounts.get(opcionId) || 0) * currentBatchSize + selectedCount * currentBatchSize;
      const effectiveStock = this.effectiveOptionStock(option)!;
      if (projected > effectiveStock) {
        const message = `Esta orden puede usar hasta ${effectiveStock} unidades de ${option.nombre}; esta selección usaría ${projected}.`;
        this.modifierSelectionError.set(message); this.toastr.warning(message); return;
      }
    }
    const remainingUnits = this.modifierRemainingUnits() - currentBatchSize;

    const lineas = this.items().filter(linea => this.modifierGroupIds.includes(linea.id));
    let pendientes = currentBatchSize;
    for (const linea of lineas) {
      if (pendientes <= 0) break;
      const cantidad = Math.min(linea.cantidad, pendientes);
      if (cantidad === linea.cantidad) this.modifierGroupIds = this.modifierGroupIds.filter(id => id !== linea.id);
      this.modifierBatchApplied.emit({ itemId: linea.id, quantity: cantidad, modificadores: selectedModifiers });
      pendientes -= cantidad;
    }

    if (remainingUnits <= 0) {
      this.closeModifierModal(true);
      return;
    }

    const totalUnits = this.modifierTotalUnits();
    const firstSavedUnit = totalUnits - this.modifierRemainingUnits() + 1;
    const lastSavedUnit = firstSavedUnit + currentBatchSize - 1;
    const savedLabel = currentBatchSize === 1
      ? `Unidad ${firstSavedUnit} guardada`
      : `Unidades ${firstSavedUnit}–${lastSavedUnit} guardadas`;
    this.modifierProgressMessage.set(`✓ ${savedLabel}. Ahora configura la unidad ${lastSavedUnit + 1} de ${totalUnits}`);
    if (this.modifierProgressTimer) clearTimeout(this.modifierProgressTimer);
    this.modifierProgressTimer = setTimeout(() => {
      this.modifierProgressMessage.set('');
      this.modifierProgressTimer = null;
    }, 1800);
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
    const grupo = this.itemsVisuales().find(item => item.id === itemId);
    for (const linea of grupo?.lineas ?? []) this.itemNoteChanged.emit({ itemId: linea.id, nota: note.trim() });
  }

  onOrderDateChange(value: string): void {
    const parsed = normalizeDateTimeValue(value || null);
    if (parsed) {
      this.orderDate.set(parsed.date);
      this.orderTime.set(parsed.time ?? this.orderTime() ?? (this.isEditing() ? null : getCurrentTimeString()));
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
