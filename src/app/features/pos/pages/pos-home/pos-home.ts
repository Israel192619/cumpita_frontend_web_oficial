import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartItem, CartItemModificador, Order, PaymentMethodOption, PosService, ClienteSearch, Mesa, Caja, CajaResumen } from '../../services';
import { Categoria } from '../../../../core/models/categoria';
import { Producto } from '../../../../core/models/producto';
import { CartPanelComponent, CategoryBarComponent, CheckoutModalComponent, PaymentMethodType, PosToolbarComponent, ProductGridComponent } from '../../components';
import { CategoriaService } from '../../../categorias/services/categoria-service';
import { ProductoService } from '../../../productos/services/producto-service';
import { ToastrService } from 'ngx-toastr';
import { Button } from '../../../../shared/components/button/button';
import { Modal } from '../../../../shared/components/modal/modal';

@Component({
  selector: 'app-pos-home',
  standalone: true,
  imports: [  
    CommonModule,
    CategoryBarComponent,
    ProductGridComponent,
    CartPanelComponent,
    CheckoutModalComponent,
    PosToolbarComponent,
    Button,
    Modal,
  ],
  templateUrl: './pos-home.html',
  styleUrls: ['./pos-home.css', './pos-home-modals.css'],
})
export class PosHome implements OnInit, OnDestroy {
  private routeSubscription?: Subscription;
  categorias = signal<Categoria[]>([]);
  productos = signal<Producto[]>([]);
  carrito = signal<CartItem[]>([]);
  baseStockByProductId = signal<Record<number, number>>({});
  productSearchQuery = signal<string>('');
  isLoadingCategorias = signal<boolean>(true);
  isLoadingProductos = signal<boolean>(false);
  isCheckoutModalOpen = signal<boolean>(false);
  isProcessingCheckout = signal<boolean>(false);
  isRefundMode = signal<boolean>(false);
  deletedItems = signal<any[]>([]);
  originalCarrito = signal<CartItem[]>([]);
  error = signal<string | null>(null);
  cajaActual = signal<Caja | null>(null);
  resumenCaja = signal<CajaResumen | null>(null);
  isCajaModalOpen = signal<boolean>(false);
  cajaModalMode = signal<'abrir' | 'cerrar'>('abrir');
  isProcessingCaja = signal<boolean>(false);
  montoCaja = signal<string>('');
  observacionCaja = signal<string>('');

  // Calculado automáticamente: lo que pagó - lo que debe pagar ahora
  refundAmount = computed(() => {
    return Math.max(0, this.paidAmount() - this.total());
  });

  // Detecta si hay cambios en el carrito vs el original de BD
  hasChanges = computed(() => {
    if (!this.isEditingOrder() || this.originalCarrito().length === 0) {
      return false;
    }
    
    // Comparar cantidad de items
    if (this.carrito().length !== this.originalCarrito().length) {
      return true;
    }
    
    // Comparar cantidades de cada item
    for (let i = 0; i < this.carrito().length; i++) {
      const current = this.carrito()[i];
      const original = this.originalCarrito()[i];
      
      if (!original || current.cantidad !== original.cantidad) {
        return true;
      }
    }
    
    return false;
  });
  isEditingOrder = signal<boolean>(false);
  editingOrderId = signal<number | null>(null);
  editingOrderSource = signal<'url' | 'pending' | 'internal' | null>(null);
  pendingOrderAction = signal<'edit' | 'pay' | null>(null);

  selectedCategoryId = signal<number | null>(null);
  selectedSubcategoryId = signal<number | null>(null);
  orderType = signal<'dine-in' | 'to-go' | 'delivery'>('dine-in');
  selectedCliente = signal<ClienteSearch | null>(null);
  selectedMesa = signal<Mesa | null>(null);
  orderDate = signal<string | null>(null);
  reservationDate = signal<string | null>(null);
  editingOrder = signal<Order | null>(null);
  isFullyPaid = computed(() => this.isEditingOrder() && this.remainingAmount() === 0);
  showHistoryButton = computed(() => this.hasPaymentHistory() && this.isFullyPaid());
  orders = signal<Order[]>([]);
  pendingOrders = signal<Order[]>([]);
  pendingOrdersSearch = signal<string>('');
  isPendingOrdersModalOpen = signal<boolean>(false);
  isHistoryModalOpen = signal<boolean>(false);
  isProductSelectorOpen = signal<boolean>(false);

  pendingOrdersCount = computed(() => this.pendingOrders().length);
  hasUnsavedChanges = computed(() => {
    return (
      this.carrito().length > 0 ||
      !!this.selectedCliente() ||
      !!this.selectedMesa() ||
      !!this.orderDate() ||
      this.isEditingOrder()
    );
  });

  filteredPendingOrders = computed(() => {
    const query = this.pendingOrdersSearch().trim().toLowerCase();
    return this.pendingOrders().filter((orden) => {
      const haystack = [
        orden.numero_orden?.toString() || orden.id.toString(),
        orden.cliente_nombre || '',
        orden.cliente_telefono || '',
        orden.mesa?.numero || '',
        orden.estado || '',
        orden.estado_pago || '',
        typeof orden.saldo_pendiente === 'number' ? orden.saldo_pendiente.toString() : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return !query || haystack.includes(query);
    });
  });

  paidAmount = computed(() => {
    const orden = this.editingOrder();
    if (!orden) {
      return 0;
    }
    return (orden.pagos || []).reduce((sum, pago) => sum + parseFloat(pago.monto_pagado.toString()), 0);
  });

  remainingAmount = computed(() => {
    const orden = this.editingOrder();
    if (!orden) {
      return 0;
    }

    // Use current cart total, not order.total from DB
    // This ensures remainingAmount updates when editing items
    return Math.max(0, this.total() - this.paidAmount());
  });

  hasPaymentHistory = computed(() => {
    return (this.editingOrder()?.pagos?.length ?? 0) > 0;
  });

  subtotal = computed(() => {
    return this.carrito().reduce((sum, item) => {
      const precioBase = parseFloat(item.precio_unitario.toString());
      const modificadoresExtra = (item.modificadores || []).reduce(
        (modSum, mod) => modSum +  parseFloat(mod.precio_extra.toString()),
        0
      );
      return sum + (precioBase + modificadoresExtra) * item.cantidad;
    }, 0);
  });

  total = computed(() => {
    // TODO: Agregar impuestos, descuentos, etc.
    return this.subtotal();
  });

  visibleProductos = computed(() => {
    const query = this.productSearchQuery().trim().toLowerCase();
    const productos = this.productos();

    if (!query) {
      return productos;
    }

    return productos.filter((producto) => {
      const haystack = `${producto.nombre || ''} ${producto.descripcion || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  cartItemCount = computed(() => {
    return this.carrito().reduce((sum, item) => sum + item.cantidad, 0);
  });

  productStockById = computed<Record<number, number>>(() => {
    return this.baseStockByProductId();
  });

  constructor(
    private posService: PosService, 
    private categoriaService: CategoriaService, 
    private productoService: ProductoService,
    private toastr: ToastrService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  private beforeUnloadHandler = (event: BeforeUnloadEvent) => {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = 'Si sales se perderán todos los cambios.';
      return event.returnValue;
    }
    return undefined;
  };

  ngOnInit(): void {
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    this.cargarCategorias();
    this.cargarProductos();
    this.loadOrders();
    this.loadPendingOrders();
    this.cargarCajaActual();
    
    // Verificar si viene un ID de orden para editar
    this.routeSubscription = this.route.queryParams.subscribe(params => {
      const orderId = params['orderId'];
      const isEdit = params['edit'] === 'true';
      
      if (orderId && isEdit) {
        this.editingOrderSource.set('url');
        this.pendingOrderAction.set('edit');
        this.cargarOrdenExistente(parseInt(orderId));
      }
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    this.routeSubscription?.unsubscribe();
  }

  cargarCajaActual(): void {
    this.posService.obtenerCajaActual().subscribe({
      next: (response) => {
        this.cajaActual.set(response.caja);
        this.resumenCaja.set(response.resumen ?? null);
      },
      error: () => {
        this.cajaActual.set(null);
        this.resumenCaja.set(null);
      },
    });
  }

  abrirModalCaja(mode: 'abrir' | 'cerrar'): void {
    this.cajaModalMode.set(mode);
    this.montoCaja.set(mode === 'cerrar' ? this.resumenCaja()?.monto_esperado?.toString() ?? '' : '');
    this.observacionCaja.set('');
    this.isCajaModalOpen.set(true);
  }

  cerrarModalCaja(): void {
    if (!this.isProcessingCaja()) {
      this.isCajaModalOpen.set(false);
    }
  }

  confirmarCaja(): void {
    const monto = Number(this.montoCaja());
    if (!Number.isFinite(monto) || monto < 0) {
      this.toastr.error('Ingresa un monto válido para la caja.');
      return;
    }

    this.isProcessingCaja.set(true);
    const observacion = this.observacionCaja().trim();

    if (this.cajaModalMode() === 'abrir') {
      this.posService.abrirCaja({ monto_apertura: monto, observacion_apertura: observacion || undefined }).subscribe({
        next: () => {
          this.isProcessingCaja.set(false);
          this.isCajaModalOpen.set(false);
          this.cargarCajaActual();
          this.toastr.success('Caja abierta correctamente.');
        },
        error: (err) => {
          this.isProcessingCaja.set(false);
          this.toastr.error(err?.error?.message || 'No se pudo abrir la caja.');
        },
      });
      return;
    }

    const caja = this.cajaActual();
    if (!caja) {
      this.isProcessingCaja.set(false);
      this.isCajaModalOpen.set(false);
      return;
    }

    this.posService.cerrarCaja(caja.id, { monto_cierre: monto, observacion_cierre: observacion || undefined }).subscribe({
      next: (response) => {
        this.isProcessingCaja.set(false);
        this.isCajaModalOpen.set(false);
        this.cajaActual.set(null);
        this.resumenCaja.set(null);
        const diferencia = Number(response.caja.diferencia || 0);
        this.toastr.success(
          diferencia === 0 ? 'Caja cerrada sin diferencias.' : `Caja cerrada con diferencia de ${this.formatearMonto(diferencia)}.`
        );
      },
      error: (err) => {
        this.isProcessingCaja.set(false);
        this.toastr.error(err?.error?.message || 'No se pudo cerrar la caja.');
      },
    });
  }

  formatearMonto(monto: number): string {
    return `Bs ${Number(monto || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  onBackRequested(): void {
    if (this.hasUnsavedChanges()) {
      const message = 'Si sales se perderán todos los cambios. ¿Deseas continuar?';
      if (!window.confirm(message)) {
        return;
      }
    }
    this.router.navigate(['/app/pedidos']);
  }

  onSaveOrderEditsRequested(): void {
    const orderId = this.editingOrderId();
    if (!this.isEditingOrder() || !orderId) {
      return;
    }

    // Construir payload según OrderPayload
    const itemsPayload = this.carrito().map((item) => ({
      producto_id: item.producto.id,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      nota: item.nota?.trim() || null,
      modificadores: (item.modificadores || []).map((m: CartItemModificador) => ({
        modificador_opcion_id: m.opcion_id,
        precio_extra: m.precio_extra,
      })),
    }));

    const order: Order = {
      id: orderId,
      items: this.carrito(),
      subtotal: this.subtotal(),
      total: this.total(),
      cliente_id: this.selectedCliente()?.id ?? null,
      cliente_nombre: this.selectedCliente()?.nombre ?? null,
      cliente_telefono: this.selectedCliente()?.telefono ?? null,
      tipo_orden: this.orderType(),
      mesa_id: this.selectedMesa()?.id ?? null,
      fecha_orden: this.orderDate() ?? null,
      fecha_reserva: this.reservationDate() ?? null,
    };

    const payload = this.posService.mapOrderToPayload(order);

    this.isProcessingCheckout.set(true);
    this.posService.actualizarOrden(orderId, payload).subscribe({
      next: () => {
        this.toastr.success('Orden actualizada correctamente');
        // Después de guardar cambios salimos del modo edición y limpiamos todo
        this.finalizarVenta();
      },
      error: (err) => {
        this.toastr.error('No se pudo guardar los cambios de la orden');
        this.isProcessingCheckout.set(false);
      },
      complete: () => {
        this.isProcessingCheckout.set(false);
      },
    });
  }

  private cargarOrdenExistente(orderId: number): void {
  this.posService.obtenerOrdenPorId(orderId).subscribe({
    next: (response: any) => {
      const orden = response?.orden;
      if (!orden) {
        this.toastr.error('No se encontró la información de la orden');
        return;
      }

      this.editingOrder.set(orden);
      this.editingOrderId.set(orderId);
      this.isEditingOrder.set(true);
      this.orderType.set((orden.tipo_orden as any) || 'dine-in');
      this.orderDate.set(this.normalizeOrderDate(orden.fecha_orden));
      this.reservationDate.set(this.normalizeOrderDate(orden.fecha_reserva));
      
      // Cargar cliente y mesa si existen
      const clienteSeleccionado: ClienteSearch | null = orden.cliente
        ? { id: orden.cliente_id, nombre: orden.cliente?.nombre || orden.cliente_nombre || '' }
        : orden.cliente_id
        ? { id: orden.cliente_id, nombre: orden.cliente_nombre || '' }
        : null;
      this.selectedCliente.set(clienteSeleccionado);

      if (orden.mesa) {
        this.selectedMesa.set({
          id: orden.mesa.id,
          numero: orden.mesa.numero || '',
          capacidad: orden.mesa.capacidad || 0,
          estado: orden.mesa.estado || 'ocupada',
        });
      } else if (orden.mesa_id) {
        this.selectedMesa.set({ id: orden.mesa_id, numero: '', capacidad: 0, estado: 'ocupada' });
      }

      // CORRECCIÓN 1: Cambiamos 'orden.items' por 'orden.detalles' que es el nombre real en tu JSON
      const detallesOriginales = orden.detalles || [];

      // Reconstruir carrito desde los detalles de la orden
      const items: CartItem[] = detallesOriginales.map((item: any, index: number) => {
        // Aseguramos que el precio base sea numérico
        const precioUnitarioNum = parseFloat(item.precio_unitario || '0');
        
        // CORRECCIÓN 2: Cambiamos 'item.modificadores' por 'item.opciones' que viene de Laravel
        const opcionesModificadores = item.opciones || [];

        const modificadoresMapeados = opcionesModificadores.map((opc: any) => {
          // Buscamos el objeto de la opción real que viene anidado en tu relación
          const opcionCatalogo = opc.modificador_opcion || opc.modificador_o_pcion || {};
          
          return {
            // Buscamos el id del grupo, si no viene de Laravel lo dejamos en 0 o el valor del catálogo
            modificador_id: opcionCatalogo.modificador_id || 0, 
            opcion_id: opc.modificador_opcion_id,
            opcion_nombre: opcionCatalogo.nombre || 'Adicional',
            precio_extra: parseFloat(opc.precio_extra || '0')
          };
        });

        // Calculamos el subtotal real de esta línea del carrito de forma matemática limpia
        const totalExtras = modificadoresMapeados.reduce((sum: number, m: any) => sum + m.precio_extra, 0);
        const subtotalLinea = (precioUnitarioNum + totalExtras) * item.cantidad;

        const producto = item.producto || {};
        const productoConModificadores = {
          ...producto,
          modificadores: producto.modificadores || producto.modificadores_estructurados || []
        };

        return {
          id: Date.now() + index, // ID único para el control de listas de Angular
          producto: productoConModificadores,
          cantidad: item.cantidad,
          precio_unitario: precioUnitarioNum,
          subtotal: subtotalLinea,
          modificadores: modificadoresMapeados,
          orden_detalle_id: item.id,
          nota: item.nota || ''
        };
      });

      // Inyectamos los platos reconstruidos directamente en el Signal del carrito
      this.carrito.set(items);
      // Guardar copia del carrito original para poder deshacer cambios
      this.originalCarrito.set(JSON.parse(JSON.stringify(items)));
      this.deletedItems.set([]);
      this.isRefundMode.set(false);
      this.productos.set(this.syncProductosConCarrito(this.productos()));
      if (this.pendingOrderAction() === 'pay') {
        this.isCheckoutModalOpen.set(true);
      }
      this.pendingOrderAction.set(null);
    },
    error: (err) => {
      this.toastr.error('Error al cargar la orden');
      this.isEditingOrder.set(false);
      this.editingOrderId.set(null);
    }
  });
}

  private cargarCategorias(): void {
    this.isLoadingCategorias.set(true);
    this.categoriaService.listarCategorias().subscribe({
      next: (categorias) => {
        this.categorias.set(categorias);
        this.isLoadingCategorias.set(false);
      },
      error: (err) => {
        this.error.set('Error al cargar categorías');
        this.isLoadingCategorias.set(false);
      },
    });
  }
  
  private cargarProductos(categoriaId?: number): void {
    this.isLoadingProductos.set(true);
    this.productoService.listarProductos(categoriaId).subscribe({
      next: (productos) => {
        const baseStocks = productos.reduce<Record<number, number>>((acc, producto) => {
          acc[producto.id] = producto.maneja_stock ? Math.max(0, producto.stock ?? 0) : Number.MAX_SAFE_INTEGER;
          return acc;
        }, {});

        this.baseStockByProductId.set(baseStocks);
        this.productos.set(this.syncProductosConCarrito(productos, baseStocks));
        this.isLoadingProductos.set(false);
        this.error.set(null);
      },
      error: (err) => {
        this.error.set('Error al cargar productos');
        this.isLoadingProductos.set(false);
      },
    });
  }

  onCategorySelected(categoryId: number | null): void {
    this.selectedCategoryId.set(categoryId);
    this.selectedSubcategoryId.set(null);
    this.cargarProductos(categoryId || undefined);
  }

  onSubcategorySelected(subcategoryId: number | null): void {
    this.selectedSubcategoryId.set(subcategoryId);
    if (subcategoryId === null) {
      return;
    }
    this.cargarProductos(subcategoryId || undefined);
  }

  onProductAdded(producto: Producto): void {
  const carrito = this.carrito();
  const currentProduct = this.productos().find((item) => item.id === producto.id);

  if (currentProduct?.maneja_stock && (currentProduct.stock || 0) <= 0) {
    return;
  }

  // 1. Buscamos si ya existe el producto en el carrito
  const existingItem = carrito.find((item) => item.producto.id === producto.id);
  const precioBaseNum = parseFloat(producto.precio.toString());

  if (existingItem) {
    existingItem.cantidad += 1;
    this.updateProductStock(producto.id, -1);
    
    const modificadoresExtra = (existingItem.modificadores || []).reduce(
      (sum, mod) => sum + parseFloat(mod.precio_extra.toString()),
      0
    );
    existingItem.subtotal = existingItem.cantidad * (existingItem.precio_unitario + modificadoresExtra);
    
    this.carrito.set([...carrito]);
  } else {
      this.updateProductStock(producto.id, -1);
      const modificadoresPredeterminados: CartItemModificador[] = [];
      const grupos = producto.modificadores || [];

      grupos.forEach(grupo => {
        grupo.opciones?.forEach(opcion => {
          if (opcion.predeterminado && opcion.activo !== false) {
            modificadoresPredeterminados.push({
              modificador_id: grupo.id,
              opcion_id: opcion.id,
              opcion_nombre: opcion.nombre,
              precio_extra: parseFloat(opcion.precio_extra.toString())
            });
          }
        });
      });

      const extrasIniciales = modificadoresPredeterminados.reduce(
        (sum, mod) => sum + parseFloat(mod.precio_extra.toString()), 
        0
      );

      const newItem: CartItem = {
        id: Date.now(),
        producto,
        cantidad: 1,
        precio_unitario: precioBaseNum, // Número puro (ej: 5)
        subtotal: precioBaseNum + extrasIniciales,
        modificadores: modificadoresPredeterminados,
      };
      
      this.carrito.set([...carrito, newItem]);
    }
  }

  onQuantityChanged(data: { itemId: number; cantidad: number }): void {
    const carrito = this.carrito();
    const item = carrito.find((i) => i.id === data.itemId);
    if (item) {
      const previousQuantity = item.cantidad;
      const nextQuantity = data.cantidad;
      const delta = previousQuantity - nextQuantity;
      item.cantidad = nextQuantity;

      if (item.producto?.maneja_stock) {
        this.updateProductStock(item.producto.id, delta);
      }

      const modificadoresExtra = (item.modificadores || []).reduce(
        (sum, mod) => sum + parseFloat(mod.precio_extra.toString()),
        0
      );
      item.subtotal = item.cantidad * (item.precio_unitario + modificadoresExtra);
      this.carrito.set([...carrito]);

      // En modo edición, si se disminuye cantidad, registrar las unidades removidas para devolución
      // SOLO si el item viene de la BD (tiene orden_detalle_id)
      if (this.isEditingOrder() && this.editingOrderId() && delta > 0 && item.orden_detalle_id) {
        // Crear un item parcial con la cantidad removida
        const removedItem: CartItem = {
          ...item,
          id: item.orden_detalle_id || Date.now(), // Usar orden_detalle_id como ID
          cantidad: delta,
          subtotal: (item.precio_unitario + modificadoresExtra) * delta,
        };
        
        this.deletedItems.set([...(this.deletedItems() || []), removedItem]);
        // refundAmount se actualiza automáticamente via computed
      }
    }
  }

  onItemRemoved(itemId: number): void {
    const carrito = this.carrito();
    const item = carrito.find((currentItem) => currentItem.id === itemId);
    if (!item) return;

    if (item?.producto?.maneja_stock) {
      this.updateProductStock(item.producto.id, item.cantidad);
    }

    const nextCarrito = carrito.filter((c) => c.id !== itemId);
    this.carrito.set(nextCarrito);

    // En modo edición, registrar item para devolución SOLO si viene de la BD (tiene orden_detalle_id)
    if (this.isEditingOrder() && this.editingOrderId() && item.orden_detalle_id) {
      this.deletedItems.set([...(this.deletedItems() || []), item]);
      // refundAmount se actualiza automáticamente via computed
    }
  }

  onItemModifiersChanged(data: { itemId: number; modificadores: CartItemModificador[] }): void {
    const carrito = this.carrito();
    const item = carrito.find((i) => i.id === data.itemId);

    if (item) {
      const modificadoresExtra = data.modificadores.reduce(
      (sum, mod) => sum + parseFloat(mod.precio_extra.toString()), 
      0
    );
      item.modificadores = data.modificadores.map(mod => ({
        ...mod,
        precio_extra: parseFloat(mod.precio_extra.toString())
      }));
      const precioBase = parseFloat(item.precio_unitario.toString());
      item.subtotal = (precioBase + modificadoresExtra) * item.cantidad;
      this.carrito.set([...carrito]);
    }
  }

  onModifierBatchApplied(data: { itemId: number; quantity: number; modificadores: CartItemModificador[] }): void {
    const carrito = this.carrito();
    const parentItem = carrito.find((item) => item.id === data.itemId);

    if (!parentItem || data.quantity <= 0) {
      return;
    }

    const precioBase = parseFloat(parentItem.precio_unitario.toString());
    const parentExtras = (parentItem.modificadores || []).reduce(
      (sum, mod) => sum + parseFloat(mod.precio_extra.toString()),
      0
    );
    const modificadoresExtra = data.modificadores.reduce(
      (sum, mod) => sum + parseFloat(mod.precio_extra.toString()),
      0
    );
    const remainingQuantity = Math.max(0, parentItem.cantidad - data.quantity);

    this.updateProductStock(parentItem.producto.id, -data.quantity);

    const variantItem: CartItem = {
      id: Date.now() + Math.floor(Math.random() * 100000),
      producto: parentItem.producto,
      cantidad: data.quantity,
      precio_unitario: precioBase,
      subtotal: (precioBase + modificadoresExtra) * data.quantity,
      modificadores: data.modificadores.map((mod) => ({
        ...mod,
        precio_extra: parseFloat(mod.precio_extra.toString()),
      })),
      nota: parentItem.nota || '',
      isModifierVariant: true,
      parentItemId: parentItem.id,
    };

    const nextCarrito = [...carrito];
    const parentIndex = nextCarrito.findIndex((item) => item.id === parentItem.id);

    if (parentIndex >= 0) {
      if (remainingQuantity <= 0) {
        nextCarrito.splice(parentIndex, 1);
      } else {
        nextCarrito[parentIndex] = {
          ...parentItem,
          cantidad: remainingQuantity,
          subtotal: (precioBase + parentExtras) * remainingQuantity,
        };
      }
    }

    const insertIndex = parentIndex >= 0 ? parentIndex + (remainingQuantity > 0 ? 1 : 0) : nextCarrito.length;
    nextCarrito.splice(insertIndex, 0, variantItem);

    this.carrito.set(this.mergeDuplicateModifierItems(nextCarrito));
  }

  onModifierModalClosed(): void {
    this.carrito.set(this.mergeDuplicateModifierItems(this.carrito()));
  }

  private mergeDuplicateModifierItems(items: CartItem[]): CartItem[] {
    const merged: CartItem[] = [];
    const seen = new Map<string, CartItem>();

    items.forEach((item) => {
      if (!item.isModifierVariant) {
        merged.push(item);
        return;
      }

      const key = [
        item.parentItemId ?? item.id,
        item.producto?.id,
        (item.modificadores || []).map((mod) => `${mod.modificador_id}:${mod.opcion_id}`).sort().join('|'),
        item.nota?.trim() || '',
      ].join('::');

      const existing = seen.get(key);
      if (existing) {
        existing.cantidad += item.cantidad;
        existing.subtotal += item.subtotal;
        return;
      }

      const clonedItem: CartItem = {
        ...item,
        modificadores: (item.modificadores || []).map((mod) => ({ ...mod })),
      };
      seen.set(key, clonedItem);
      merged.push(clonedItem);
    });

    return merged;
  }

  onOrderTypeChanged(tipoOrden: 'dine-in' | 'to-go' | 'delivery'): void {
    this.orderType.set(tipoOrden);
  }

  private resetCurrentOrderState(): void {
    this.carrito.set([]);
    this.selectedMesa.set(null);
    this.orderDate.set(null);
    this.reservationDate.set(null);
    this.orderType.set('dine-in');
    this.isEditingOrder.set(false);
    this.editingOrderId.set(null);
    this.editingOrderSource.set(null);
    this.pendingOrderAction.set(null);
    this.editingOrder.set(null);
  }

  onClienteSelected(cliente: ClienteSearch | null): void {
    const currentClienteId = this.selectedCliente()?.id ?? null;
    const newClienteId = cliente?.id ?? null;
    
    // If cliente is cleared via the "Cambiar" button:
    // - when editing an order: reset full order state (cancel edit)
    // - otherwise: only unset the selected client, keep cart intact
    if (cliente === null) {
      if (this.isEditingOrder()) {
        this.resetCurrentOrderState();
      } else {
        this.selectedCliente.set(null);
        return;
      }
    }

    this.selectedCliente.set(cliente);
  }

  onOrderDateChanged(value: string | null): void {
    this.orderDate.set(this.normalizeOrderDate(value));
  }

  onReservationDateChanged(value: string | null): void {
    this.reservationDate.set(this.normalizeOrderDate(value));
  }

  onItemNoteChanged(data: { itemId: number; nota: string }): void {
    const carrito = this.carrito();
    const item = carrito.find((i) => i.id === data.itemId);
    if (item) {
      item.nota = data.nota;
      this.carrito.set([...carrito]);
    }
  }

  onCheckoutRequested(): void {
    if (!this.selectedCliente()) {
      this.error.set('Selecciona un cliente para continuar con la venta.');
      this.toastr.error('Selecciona un cliente para continuar con la venta.');
      return;
    }
    this.isCheckoutModalOpen.set(true);
  }

  onPayLaterRequested(): void {
    if (!this.selectedCliente()) {
      this.error.set('Selecciona un cliente para continuar con la orden.');
      this.toastr.error('Selecciona un cliente para continuar con la orden.');
      return;
    }
    this.isProcessingCheckout.set(true);
    const order: Order = {
      id: this.editingOrderId() || 0,
      items: this.carrito(),
      subtotal: this.subtotal(),
      total: this.total(),
      metodo_pago: 'efectivo',
      estado: 'adeudado',
      cliente_id: this.selectedCliente()?.id,
      cliente_nombre: this.selectedCliente()?.nombre,
      cliente_telefono: this.selectedCliente()?.telefono,
      tipo_orden: this.orderType(),
      mesa_id: this.selectedMesa()?.id,
      fecha_orden: this.orderDate() ?? null,
      fecha_reserva: this.reservationDate() ?? null,
    };

    if (this.isEditingOrder() && this.editingOrderId()) {
      const orderId = this.editingOrderId()!;
      this.posService.actualizarOrden(orderId, this.posService.mapOrderToPayload(order)).subscribe({
        next: () => {
          this.finalizarVenta();
          this.isProcessingCheckout.set(false);
          this.isEditingOrder.set(false);
          this.editingOrderId.set(null);
          this.mostrarExito('Orden adeudada actualizada exitosamente');
        },
        error: () => {
          this.error.set('Error al actualizar la orden adeudada');
          this.isProcessingCheckout.set(false);
        },
      });
    } else {
      this.posService.crearOrden(order).subscribe({
        next: (response) => {
          this.finalizarVenta();
          this.isProcessingCheckout.set(false);
          this.mostrarExito('Orden adeudada creada exitosamente');
        },
        error: () => {
          this.error.set('Error al procesar la orden adeudada');
          this.isProcessingCheckout.set(false);
        },
      });
    }
  }

  onCartCleared(): void {
    this.carrito().forEach((item) => {
      if (item.producto?.maneja_stock) {
        this.updateProductStock(item.producto.id, item.cantidad);
      }
    });
    this.carrito.set([]);
    this.selectedCliente.set(null);
    this.selectedMesa.set(null);
    this.orderDate.set(null);
    this.reservationDate.set(null);
    this.editingOrder.set(null);
    this.isEditingOrder.set(false);
    this.editingOrderId.set(null);
    this.editingOrderSource.set(null);
    this.pendingOrderAction.set(null);
  }

  onCheckoutConfirmed(data: {
    metodoPago: PaymentMethodType;
    clienteId?: number;
    mesaId?: number;
    montoRecibido?: number;
    tipoPago?: 'pago' | 'devolucion';
  }): void {
    this.isProcessingCheckout.set(true);

    if (data.metodoPago === 'efectivo' && !this.cajaActual()) {
      const mensaje = 'Abre una caja antes de registrar pagos o devoluciones en efectivo.';
      this.error.set(mensaje);
      this.toastr.error(mensaje);
      this.isProcessingCheckout.set(false);
      return;
    }

    if (!this.selectedCliente() && !data.clienteId) {
      this.error.set('Selecciona un cliente para continuar con la venta.');
      this.toastr.error('Selecciona un cliente para continuar con la venta.');
      this.isProcessingCheckout.set(false);
      return;
    }

    const montoRecibido = data.montoRecibido ?? 0;
    const tipoPago = data.tipoPago ?? 'pago';

    // Si es modo refund, SOLO registrar el pago, NO actualizar la orden
    if (this.isRefundMode() && this.isEditingOrder() && this.editingOrderId()) {
      // const orderId = this.editingOrderId()!;
      
      // // Calcular el cambio: si el cliente trae más de lo necesario para devolver
      // const cambio = Math.max(0, montoRecibido - this.refundAmount());
      
      // this.posService.crearPagoOrden({
      //   id_orden: orderId,
      //   monto_recibido: montoRecibido,
      //   metodo_pago: data.metodoPago,
      //   tipo_pago: 'devolucion',
      //   monto_pagado: this.refundAmount(), // El monto que se debe devolver
      //   cambio_devuelto: cambio, // El cambio que el cliente me da
      // }).subscribe({
      //   next: () => {
      //     this.finalizarVenta();
      //     this.isCheckoutModalOpen.set(false);
      //     this.isProcessingCheckout.set(false);
      //     this.isEditingOrder.set(false);
      //     this.editingOrderId.set(null);
      //     this.isRefundMode.set(false);
      //     this.deletedItems.set([]);
      //     this.mostrarExito('Devolución registrada exitosamente');
      //   },
      //   error: (err) => {
      //     console.log('Error al registrar la devolución:', err);
      //     this.error.set('Error al registrar la devolución');
      //     this.isProcessingCheckout.set(false);
      //   },
      // });
      // return;
      const orderId = this.editingOrderId()!;

      const order: Order = {
        id: orderId,
        items: this.carrito(),
        subtotal: this.subtotal(),
        total: this.total(),
        metodo_pago: data.metodoPago,
        cliente_id: data.clienteId ?? this.selectedCliente()?.id,
        cliente_nombre: this.selectedCliente()?.nombre,
        cliente_telefono: this.selectedCliente()?.telefono,
        tipo_orden: this.orderType(),
        mesa_id: data.mesaId ?? this.selectedMesa()?.id,
        fecha_orden: this.orderDate() ?? null,
        fecha_reserva: this.reservationDate() ?? null,
      };

      const payload = this.posService.mapOrderToPayload(order);

      // 1. Primero actualizamos la orden
      this.posService.actualizarOrden(orderId, payload).subscribe({
        next: () => {

          // 2. Luego registramos la devolución
          const cambio = Math.max(
            0,
            montoRecibido - this.refundAmount()
          );

          this.posService.crearPagoOrden({
            id_orden: orderId,
            monto_recibido: montoRecibido,
            metodo_pago: data.metodoPago,
            tipo_pago: 'devolucion',
            monto_pagado: this.refundAmount(),
            cambio_devuelto: cambio,
          }).subscribe({
            next: () => {
              this.finalizarVenta();
              this.isCheckoutModalOpen.set(false);
              this.isProcessingCheckout.set(false);
              this.isEditingOrder.set(false);
              this.editingOrderId.set(null);
              this.isRefundMode.set(false);
              this.deletedItems.set([]);

              this.mostrarExito(
                'Orden actualizada y devolución registrada exitosamente'
              );
            },
            error: (err) => {
              console.error('Error al registrar la devolución:', err);
              this.error.set('Error al registrar la devolución');
              this.isProcessingCheckout.set(false);
            },
          });
        },
        error: (err) => {
          console.error('Error al actualizar la orden:', err);
          this.error.set('Error al actualizar la orden');
          this.isProcessingCheckout.set(false);
        },
      });

      return;
    }

    // Modo normal: actualizar orden y luego registrar pago
    const order: Order = {
      id: this.editingOrderId() || 0,
      items: this.carrito(),
      subtotal: this.subtotal(),
      total: this.total(),
      metodo_pago: data.metodoPago,
      cliente_id: data.clienteId ?? this.selectedCliente()?.id,
      cliente_nombre: this.selectedCliente()?.nombre,
      cliente_telefono: this.selectedCliente()?.telefono,
      tipo_orden: this.orderType(),
      mesa_id: data.mesaId ?? this.selectedMesa()?.id,
      fecha_orden: this.orderDate() ?? null,
      fecha_reserva: this.reservationDate() ?? null,
    };

    if (this.isEditingOrder() && this.editingOrderId()) {
      const orderId = this.editingOrderId()!;
      // Primero actualizamos la orden
      this.posService.actualizarOrden(orderId, this.posService.mapOrderToPayload(order)).subscribe({
        next: () => {
          // Luego registramos el pago
          this.posService.crearPagoOrden({
            id_orden: orderId,
            monto_recibido: montoRecibido,
            metodo_pago: data.metodoPago,
            tipo_pago: tipoPago,
          }).subscribe({
            next: () => {
              this.finalizarVenta();
              this.isCheckoutModalOpen.set(false);
              this.isProcessingCheckout.set(false);
              this.isEditingOrder.set(false);
              this.editingOrderId.set(null);
              this.isRefundMode.set(false);
              this.deletedItems.set([]);
              this.mostrarExito('Orden actualizada y pagada exitosamente');
            },
            error: (err) => {
              this.error.set('Error al registrar el pago');
              this.isProcessingCheckout.set(false);
            },
          });
        },
        error: () => {
          this.error.set('Error al actualizar la orden');
          this.isProcessingCheckout.set(false);
        },
      });
    } else {
      // Crear nueva orden y luego registrar pago
      //const createPayload = this.posService.mapOrderToPayload(order);
      //console.log('Creating order payload:', createPayload);
      this.posService.crearOrden(order).subscribe({
        next: (response: any) => {
          // Backend may return the created order under different keys depending on endpoint/version.
          const createdOrderId = response?.orden?.id ?? response?.order?.id ?? response?.id ?? null;
          if (createdOrderId && montoRecibido > 0) {
            this.posService.crearPagoOrden({
              id_orden: createdOrderId,
              monto_recibido: montoRecibido,
              metodo_pago: data.metodoPago,
              tipo_pago: tipoPago,
            }).subscribe({
              next: () => {
                this.finalizarVenta();
                this.isCheckoutModalOpen.set(false);
                this.isProcessingCheckout.set(false);
                this.isRefundMode.set(false);
                this.deletedItems.set([]);
                this.mostrarExito('Venta completada exitosamente');
              },
              error: (err) => {
                console.error('crearPagoOrden error:', err);
                this.error.set('Error al registrar el pago');
                this.isProcessingCheckout.set(false);
              },
            });
          } else {
            // No hay monto recibido o no se obtuvo id, finalizar sin pago
            console.warn('No createdOrderId or montoRecibido <= 0, skipping payment. createdOrderId=', createdOrderId, 'montoRecibido=', montoRecibido);
            this.finalizarVenta();
            this.isCheckoutModalOpen.set(false);
            this.isProcessingCheckout.set(false);
            this.mostrarExito('Venta completada exitosamente');
          }
        },
        error: (err) => {
          console.error('crearOrden error:', err);
          this.error.set('Error al procesar la venta');
          this.isProcessingCheckout.set(false);
        },
      });
    }
  }

  onCheckoutCancelled(): void {
    this.isCheckoutModalOpen.set(false);
    this.isRefundMode.set(false);
  }

  onUndoChanges(): void {
    if (!this.isEditingOrder() || this.originalCarrito().length === 0) {
      this.toastr.warning('No hay cambios para deshacer');
      return;
    }
    
    // Restaurar el carrito al estado original
    this.carrito.set(JSON.parse(JSON.stringify(this.originalCarrito())));
    this.deletedItems.set([]);
    this.isRefundMode.set(false);
    this.toastr.success('Cambios deshhechos');
  }

  onRefundActionRequested(): void {
    if (this.refundAmount() <= 0) {
      this.toastr.warning('No hay monto para devolver.');
      return;
    }

    this.isRefundMode.set(true);
    this.isCheckoutModalOpen.set(true);
  }

  onStockAdjusted(): void {
    this.cargarProductos(this.selectedSubcategoryId() ?? this.selectedCategoryId() ?? undefined);
  }

  private finalizarVenta(): void {
    this.carrito.set([]);
    this.originalCarrito.set([]);
    this.deletedItems.set([]);
    this.isRefundMode.set(false);
    this.selectedCategoryId.set(null);
    this.selectedSubcategoryId.set(null);
    this.selectedCliente.set(null);
    this.selectedMesa.set(null);
    this.orderDate.set(null);
    this.reservationDate.set(null);
    this.isEditingOrder.set(false);
    this.editingOrderId.set(null);
    this.editingOrderSource.set(null);
    this.pendingOrderAction.set(null);
    this.cargarProductos();
    this.loadOrders();
    this.loadPendingOrders();
    this.cargarCajaActual();
  }

  private mostrarExito(mensaje: string): void {
    this.toastr.success(mensaje, 'Éxito');
  }

  onCancelEditMode(): void {
    const source = this.editingOrderSource();
    this.resetOrderSelection();
    if (source === 'url') {
      this.router.navigate(['/app/pedidos']);
    }
  }

  onViewHistoryRequested(): void {
    // Abrir modal de historial para la orden en edición
    if (!this.isEditingOrder() || !this.editingOrderId()) {
      // nada que mostrar
      return;
    }
    this.isHistoryModalOpen.set(true);
  }

  closeHistoryModal(): void {
    this.isHistoryModalOpen.set(false);
  }

  onProductSearchChanged(query: string): void {
    this.productSearchQuery.set(query);
  }

  openProductSelector(): void {
    this.isProductSelectorOpen.set(true);
  }

  closeProductSelector(): void {
    this.isProductSelectorOpen.set(false);
  }

  onMobileProductAdded(product: Producto): void {
    this.onProductAdded(product);
    this.closeProductSelector();
  }

  onPendingOrdersRequested(): void {
    this.loadPendingOrders();
    this.isPendingOrdersModalOpen.set(true);
  }

  closePendingOrdersModal(): void {
    this.isPendingOrdersModalOpen.set(false);
  }

  onExistingOrderSelected(orderId: number): void {
    this.prepareOrderSelection('internal', 'edit');
    this.cargarOrdenExistente(orderId);
  }

  onEditPendingOrder(orderId: number): void {
    this.prepareOrderSelection('pending', 'edit');
    this.closePendingOrdersModal();
    this.cargarOrdenExistente(orderId);
  }

  onPayPendingOrder(orderId: number): void {
    this.prepareOrderSelection('pending', 'pay');
    this.closePendingOrdersModal();
    this.cargarOrdenExistente(orderId);
  }

  private prepareOrderSelection(source: 'pending' | 'internal', action: 'edit' | 'pay'): void {
    if (this.isEditingOrder()) this.resetOrderSelection();
    this.editingOrderSource.set(source);
    this.pendingOrderAction.set(action);
  }

  private resetOrderSelection(): void {
    this.isEditingOrder.set(false);
    this.editingOrderId.set(null);
    this.editingOrder.set(null);
    this.editingOrderSource.set(null);
    this.pendingOrderAction.set(null);
    this.carrito.set([]);
    this.originalCarrito.set([]);
    this.selectedCliente.set(null);
    this.selectedMesa.set(null);
    this.orderDate.set(null);
    this.reservationDate.set(null);
    this.deletedItems.set([]);
    this.isRefundMode.set(false);
  }

  loadPendingOrders(): void {
    this.posService.obtenerOrdenes().subscribe({
      next: (ordenes) => {
        const pendientes = ordenes.filter((orden) => this.isPendingOrder(orden));
        this.pendingOrders.set(pendientes);
        this.pendingOrdersSearch.set('');
      },
      error: () => {
        this.pendingOrders.set([]);
      },
    });
  }

  private loadOrders(): void {
    this.posService.obtenerOrdenes().subscribe({
      next: (ordenes) => this.orders.set(ordenes),
      error: () => this.orders.set([]),
    });
  }

  private isPendingOrder(orden: Order): boolean {
    return (
      orden.estado_pago === 'pendiente' ||
      orden.estado_pago === 'parcial' ||
      orden.estado === 'adeudado' ||
      (typeof orden.saldo_pendiente === 'number' && orden.saldo_pendiente > 0)
    );
  }

  getPendingOrderRemainingAmount(order: Order): number {
    if (typeof order.saldo_pendiente === 'number') {
      return Math.max(0, order.saldo_pendiente);
    }

    const paid = (order.pagos || []).reduce((sum, pago) => sum + parseFloat(pago.monto_pagado.toString()), 0);
    return Math.max(0, Number(order.total) - paid);
  }

  formatPrice(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  private updateProductStock(productId: number, delta: number): void {
    const productos = [...this.productos()];
    const producto = productos.find((item) => item.id === productId);

    if (!producto?.maneja_stock) {
      return;
    }

      const currentStock = producto.stock ?? 0;
    producto.stock = Math.max(0, currentStock + delta);
    this.productos.set(productos);
  }

  private syncProductosConCarrito(productosBase: Producto[], baseStocks?: Record<number, number>): Producto[] {
    const cartCounts = new Map<number, number>();

    this.carrito().forEach((item) => {
      const productId = item.producto?.id;
      if (!productId) {
        return;
      }

      cartCounts.set(productId, (cartCounts.get(productId) ?? 0) + item.cantidad);
    });

    return productosBase.map((producto) => {
      if (!producto.maneja_stock) {
        return producto;
      }

      const baseStock = baseStocks?.[producto.id] ?? producto.stock ?? 0;
      const reservedStock = cartCounts.get(producto.id) ?? 0;

      return {
        ...producto,
        stock: Math.max(0, baseStock - reservedStock),
      };
    });
  }

  private getTodayDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private normalizeOrderDate(value?: string | null): string | null {
    if (!value || !value.trim()) {
      return null;
    }

    const normalized = value.trim();

    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(normalized)) {
      return normalized.replace(' ', 'T');
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return `${normalized}T00:00:00`;
    }

    if (/^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}(:\d{2})?$/.test(normalized)) {
      const cleaned = normalized.replace(' ', 'T');
      return cleaned.includes(':') && cleaned.split(':').length === 2 ? `${cleaned}:00` : cleaned;
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{1,2}:\d{2}/.test(normalized)) {
      const dateTime = normalized.replace(' ', 'T');
      return dateTime.includes(':') && dateTime.split(':').length === 2 ? `${dateTime}:00` : dateTime;
    }

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      const hours = String(parsed.getHours()).padStart(2, '0');
      const minutes = String(parsed.getMinutes()).padStart(2, '0');
      const seconds = String(parsed.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    }

    return null;
  }

  // ==================== HELPERS ====================
  trackByCategoria = (index: number, cat: Categoria) => cat.id;
}
