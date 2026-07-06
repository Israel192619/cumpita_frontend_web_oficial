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

  quantityChanged = output<{ itemId: number; cantidad: number }>();
  itemRemoved = output<number>();
  checkoutRequested = output<void>();
  payLaterRequested = output<void>();
  cartCleared = output<void>();
  orderTypeChanged = output<'dine-in' | 'to-go' | 'delivery'>();
  clienteSelected = output<ClienteSearch | null>();
  mesaSelected = output<Mesa | null>();
  itemModifiersChanged = output<{ itemId: number; modificadores: CartItemModificador[] }>();

  // Estados locales para el carrito
  orderType = signal<'dine-in' | 'to-go' | 'delivery'>('dine-in');
  selectedCliente = signal<ClienteSearch | null>(null);
  selectedMesa = signal<Mesa | null>(null);
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

  // Long-press handling
  longPressTimer: any = null;
  longPressTriggered = signal<boolean>(false);

  constructor(private posService: PosService, private confirmDialog: ConfirmDialogService) {
    effect(() => {
      this.orderType.set(this.orderTypeInput());
      this.selectedCliente.set(this.selectedClienteInput());
      this.selectedMesa.set(this.selectedMesaInput());
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
    this.modifierModalOpen.set(true);
  }

  closeModifierModal(): void {
    this.modifierModalOpen.set(false);
    this.modifierModalItem.set(null);
    this.draftModifiers.set([]);
  }

  // getModifierGroups(producto: Producto): ModificadorEstructurado[] {
  //   console.log('Producto:', producto);
  //   return producto?.modificadores || [];
  // }
  modifierGroups = computed<ModificadorEstructurado[]>(() => {
    const item = this.modifierModalItem();
    // El backend puede devolver los modificadores como 'modificadores' o 'modificadores_estructurados'
    return (item?.producto as any)?.modificadores || (item?.producto as any)?.modificadores_estructurados || [];
  });

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

    this.itemModifiersChanged.emit({
      itemId: item.id,
      modificadores: this.draftModifiers().map(mod => ({ ...mod })),
    });
    this.closeModifierModal();
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
  }

  getProductImage(producto: any): string {
    return producto.imagen_url || '/images/no-image.png';
  }

  trackByItem = (index: number, item: CartItem) => item.id;
}
