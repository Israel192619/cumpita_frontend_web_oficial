import { Component, computed, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CartItem, CartItemModificador, ClienteSearch, Mesa, PosService } from '@app/features/pos/services/pos-service';
import { MesasModalComponent } from '../mesas-modal/mesas-modal';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog-service';
import { ModificadorEstructurado, ModificadorOpcion, Producto, ProductoOpcion } from '@app/core/models/producto';

@Component({
  selector: 'app-cart-panel',
  standalone: true,
  imports: [CommonModule, MesasModalComponent],
  templateUrl: './cart-panel.html',
  styleUrl: './cart-panel.css',
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
  stockByProductId = input<Record<number, number>>({});

  quantityChanged = output<{ itemId: number; cantidad: number }>();
  itemRemoved = output<number>();
  checkoutRequested = output<void>();
  payLaterRequested = output<void>();
  cartCleared = output<void>();
  orderTypeChanged = output<'dine-in' | 'to-go' | 'delivery'>();
  orderDateChanged = output<string | null>();
  clienteSelected = output<ClienteSearch | null>();
  mesaSelected = output<Mesa | null>();
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

  // Long-press handling
  longPressTimer: any = null;
  longPressTriggered = signal<boolean>(false);

  constructor(private posService: PosService, private confirmDialog: ConfirmDialogService) {
    effect(() => {
      this.orderType.set(this.orderTypeInput());
      this.selectedCliente.set(this.selectedClienteInput());
      this.selectedMesa.set(this.selectedMesaInput());
      const incomingDate = this.orderDateInput();
      const normalized = this.normalizeOrderDateTime(incomingDate);
      this.orderDate.set(normalized?.date ?? this.getTodayDateString());
      this.orderTime.set(normalized?.time ?? null);

      const nextNotes = new Map<number, string>();
      this.items().forEach((item) => {
        const note = item.nota?.trim();
        if (note) {
          nextNotes.set(item.id, note);
        }
      });
      this.itemNotes.set(nextNotes);
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

  onCheckout(): void {
    this.checkoutRequested.emit();
  }

  onPayLater(): void {
    this.payLaterRequested.emit();
  }
  onCancelOrder() {
    this.confirmDialog.confirm({
      title: 'Cancelar orden',
      message: '¿Estás seguro de cancelar esta orden? Esta acción no se puede deshacer.'
    }).subscribe(result => {
      if (result) {
        this.itemNotes.set(new Map());
        this.orderType.set('dine-in');
        this.selectedCliente.set(null);
        this.selectedMesa.set(null);
        this.orderDate.set(null);
        this.orderTime.set(null);
        this.orderDateChanged.emit(null);
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
    return this.orderDate() ?? this.getTodayDateString();
  }

  getOrderTimeValue(): string {
    return this.orderTime() ?? '';
  }

  clearOrderTime(): void {
    this.orderTime.set(null);
    this.emitOrderDateTime();
  }

  addMinutesToOrderDate(minutes: number): void {
    const now = new Date();
    const calculated = new Date(now.getTime() + minutes * 60000);
    const nextTime = this.formatTimeOnly(calculated);
    const dateValue = this.orderDate() ?? this.getTodayDateString();
    this.orderTime.set(nextTime);
    this.orderDate.set(dateValue);
    this.emitOrderDateTime();
  }

  formatPrice(price: number): string {
    // Aseguramos que el valor sea un número limpio
    const cleanPrice = typeof price === 'string' ? parseFloat(price) : price;

    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0, // Si es entero, no muestra decimales (ej: $ 5)
      maximumFractionDigits: 2, // Si tiene decimales, muestra hasta dos (ej: $ 5,59)
    }).format(cleanPrice);
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
    this.searchQuery.set(cliente.nombre);
    this.clientesResults.set([]);
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
    const nextDate = this.normalizeOrderDateOnly(value || null);
    this.orderDate.set(nextDate ?? this.getTodayDateString());
    this.emitOrderDateTime();
  }

  onOrderTimeChange(value: string): void {
    const timeValue = value ? value.trim() : null;
    this.orderTime.set(timeValue);
    this.emitOrderDateTime();
  }

  getProductImage(producto: any): string {
    return producto.imagen_url || '/images/no-image.png';
  }

  private getTodayDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private emitOrderDateTime(): void {
    const dateValue = this.orderDate() ?? this.getTodayDateString();
    const timeValue = this.orderTime();
    const payload = timeValue ? `${dateValue}T${timeValue}` : dateValue;
    this.orderDateChanged.emit(payload);
  }

  private normalizeOrderDateTime(value: string | null | undefined): { date: string; time: string | null } | null {
    if (!value || !value.trim()) {
      return null;
    }

    const normalized = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return { date: normalized, time: null };
    }

    if (/^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}$/.test(normalized)) {
      const cleaned = normalized.replace(' ', 'T').slice(0, 16);
      const [date, time] = cleaned.split('T');
      return { date, time };
    }

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      const date = this.formatDateOnly(parsed);
      const time = this.formatTimeOnly(parsed);
      return { date, time };
    }

    return null;
  }

  private normalizeOrderDateOnly(value: string | null | undefined): string | null {
    if (!value || !value.trim()) {
      return null;
    }

    const normalized = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return normalized;
    }

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return this.formatDateOnly(parsed);
    }

    return null;
  }

  private createDateAtCurrentTime(dateValue: string): Date {
    const now = new Date();
    return new Date(`${dateValue}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  }

  private parseDateTimeInput(value: string | null | undefined): Date {
    if (!value) {
      return new Date();
    }

    const normalized = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return new Date(`${normalized}T00:00`);
    }

    if (/^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}$/.test(normalized)) {
      return new Date(normalized.replace(' ', 'T'));
    }

    return new Date(normalized);
  }

  private formatDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatTimeOnly(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private formatDateTimeForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  trackByItem = (index: number, item: CartItem) => item.id;
}
