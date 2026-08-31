import { Component, signal, computed, effect, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartItem, CartItemModificador, Order, PaymentMethodOption, PosService, ClienteSearch, Mesa, Caja, CajaResumen, CajaUsuario } from '../../services';
import { Categoria } from '../../../../core/models/categoria';
import { Producto } from '../../../../core/models/producto';
import { CartPanelComponent, CategoryBarComponent, CheckoutModalComponent, PaymentMethodType, PosToolbarComponent, ProductGridComponent } from '../../components';
import { CategoriaService } from '../../../categorias/services/categoria-service';
import { ProductoService } from '../../../productos/services/producto-service';
import { ToastrService } from 'ngx-toastr';
import { Button } from '../../../../shared/components/button/button';
import { Modal } from '../../../../shared/components/modal/modal';
import { formatCurrency } from '@app/core/config/currency.config';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog-service';
import { ReverbService } from '../../../../core/services/reverb-service';
import { AuthService } from '../../../../core/services/auth-service';
import { normalizeAccessName } from '../../../../core/auth/role-access';
import { ThemeService } from '../../../../core/services/theme-service';

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
  readonly operationMode: 'pos' | 'preorden';
  private routeSubscription?: Subscription;
  private orderUpdatesSubscription?: Subscription;
  private stockUpdatesSubscription?: Subscription;
  private reservationUpdatesSubscription?: Subscription;
  private cajaUpdatesSubscription?: Subscription;
  private reservationTimer?: ReturnType<typeof setTimeout>;
  private reservationSyncing = false;
  private reservationDirty = false;
  private reservationSessionId = this.createReservationSessionId();
  categorias = signal<Categoria[]>([]);
  productos = signal<Producto[]>([]);
  allProductos = signal<Producto[]>([]);
  carrito = signal<CartItem[]>([]);
  baseStockByProductId = signal<Record<number, number>>({});
  productSearchQuery = signal<string>('');
  isLoadingGlobalProducts = signal(false);
  private globalProductsLoaded = false;
  private globalProductLoadCallbacks: Array<() => void> = [];
  private productSearchTimer?: ReturnType<typeof setTimeout>;
  private productAddFrame?: number;
  private pendingProductAdds = new Map<number, { producto: Producto; cantidad: number }>();
  private isLoadingOrderLists = false;
  private resetPendingSearchOnOrderLoad = false;
  private resetPreordersSearchOnOrderLoad = false;
  private leaveAlreadyConfirmed = false;
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
  cajaModalMode = signal<'abrir' | 'cerrar' | 'gestionar'>('abrir');
  isProcessingCaja = signal<boolean>(false);
  montoCaja = signal<string>('');
  observacionCaja = signal<string>('');
  usuariosDisponiblesCaja = signal<CajaUsuario[]>([]);
  usuariosSeleccionadosCaja = signal<number[]>([]);

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
  preorderDate = signal<string | null>(null);
  editingOrder = signal<Order | null>(null);
  isFullyPaid = computed(() => this.isEditingOrder() && this.remainingAmount() === 0);
  showHistoryButton = computed(() => this.hasPaymentHistory() && this.isFullyPaid());
  orders = signal<Order[]>([]);
  pendingOrders = signal<Order[]>([]);
  preorders = signal<Order[]>([]);
  pendingOrdersSearch = signal<string>('');
  preordersSearch = signal<string>('');
  todayOrdersSearch = signal<string>('');
  isPendingOrdersModalOpen = signal<boolean>(false);
  isTodayOrdersModalOpen = signal<boolean>(false);
  todayOrderDetail = signal<Order | null>(null);
  todayOrderRemovedItems = signal<Array<{ key: string; nombre: string; cantidad: number; subtotal: number }>>([]);
  isGastoModalOpen = signal(false);
  isProcessingGasto = signal(false);
  gastoCategoria = signal('INSUMOS');
  gastoConcepto = signal('');
  gastoMonto = signal('');
  readonly categoriasGasto = ['INSUMOS', 'LIMPIEZA', 'GAS', 'CARBON', 'TRANSPORTE', 'MANTENIMIENTO', 'SERVICIOS', 'PERSONAL', 'OTROS'];
  isPreordersModalOpen = signal<boolean>(false);
  isHistoryModalOpen = signal<boolean>(false);
  isProductSelectorOpen = signal<boolean>(false);
  isMobileActionsOpen = signal<boolean>(false);
  isCajero = signal(false);

  pendingOrdersCount = computed(() => this.pendingOrders().length);
  preordersCount = computed(() => this.preorders().length);
  hasUnsavedChanges = computed(() => {
    const hasStartedOrder =
      this.carrito().length > 0 ||
      !!this.selectedCliente() ||
      !!this.selectedMesa() ||
      this.orderType() !== 'dine-in' ||
      this.isEditingOrder();

    const hasScheduledPreorder =
      this.operationMode === 'pos' && !!this.preorderDate();

    return (
      hasStartedOrder ||
      hasScheduledPreorder
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

    const pagos = orden.pagos || [];
    if (pagos.length > 0) {
      return pagos.reduce((sum, pago) => sum + Number(pago.monto_pagado || 0), 0);
    }

    // Respaldo para órdenes parciales: el API también expone el saldo pendiente.
    // Así el POS no pierde el monto ya cobrado si la relación de pagos llega vacía.
    const totalOriginal = Number(orden.total || 0);
    const saldoPendiente = Number(orden.saldo_pendiente);
    if (Number.isFinite(saldoPendiente)) {
      return Math.max(0, totalOriginal - saldoPendiente);
    }

    return 0;
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
    const productos = query ? this.allProductos() : this.productos();

    if (!query) {
      return productos;
    }

    return productos.filter((producto) => {
      const haystack = `${producto.nombre || ''} ${producto.descripcion || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  filteredTodayOrders = computed(() => {
    const query = this.todayOrdersSearch().trim().toLowerCase();
    const today = this.getTodayDateString();
    return this.orders().filter(orden => {
      if (orden.fecha_orden?.slice(0, 10) !== today) return false;
      const searchable = [orden.numero_orden ?? orden.id, orden.cliente_nombre ?? '', orden.mesa?.numero ?? '', orden.estado_pago ?? '', orden.estado ?? '']
        .join(' ').toLowerCase();
      return !query || searchable.includes(query);
    });
  });

  filteredPreorders = computed(() => {
    const query = this.preordersSearch().trim().toLowerCase();
    return this.preorders().filter((orden) => {
      const haystack = [
        orden.numero_orden?.toString() || orden.id.toString(),
        orden.cliente_nombre || '',
        orden.cliente_telefono || '',
        orden.mesa?.numero || '',
        orden.tipo_orden || '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return !query || haystack.includes(query);
    });
  });
  globalSearchResults = computed(() => this.productSearchQuery().trim() ? this.visibleProductos() : []);

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
    private router: Router,
    private confirmDialog: ConfirmDialogService,
    private reverb: ReverbService,
    private auth: AuthService,
    readonly themeService: ThemeService
  ) {
    this.operationMode = this.route.snapshot.data['mode'] === 'preorden' ? 'preorden' : 'pos';
    effect(() => {
      const items = this.reservationItems();
      if (this.operationMode === 'pos' && !this.isEditingOrder()) this.scheduleReservationSync(items);
    });
  }

  private beforeUnloadHandler = (event: BeforeUnloadEvent) => {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = 'Si sales se perderán todos los cambios.';
      return event.returnValue;
    }
    return undefined;
  };

  ngOnInit(): void {
    this.themeService.initialize();
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    this.cargarCategorias();
    this.cargarProductos();
    this.auth.me().subscribe({
      next: user => this.isCajero.set(['cajero', 'caja'].includes(normalizeAccessName(user.role?.nombre))),
    });
    if (this.operationMode === 'preorden') {
      this.preorderDate.set(this.defaultPreorderDate());
    } else {
      this.refreshOrderLists(true, true);
      this.cargarCajaActual();
      this.orderUpdatesSubscription = this.reverb.escucharCanal('canal-ordenes', '.OrdenCocinaActualizada').subscribe(() => {
        this.refreshOrderLists();
      });
      this.stockUpdatesSubscription = this.reverb.escucharCanal('canal-inventario', '.StockActualizado').subscribe((event: { producto_id?: number; stock?: number }) => {
        if (event.producto_id == null || event.stock == null) return;
        this.applyRemoteStock(event.producto_id, event.stock);
      });
      this.reservationUpdatesSubscription = this.reverb.escucharCanal('canal-inventario', '.ReservaStockActualizada').subscribe(() => {
        this.cargarProductos(this.selectedSubcategoryId() ?? this.selectedCategoryId() ?? undefined, true);
        if (this.globalProductsLoaded) this.cargarCatalogoGlobal(true);
      });
      this.cajaUpdatesSubscription = this.reverb.escucharCanal('canal-caja', '.CajaActualizada').subscribe(() => {
        this.cargarCajaActual();
      });
    }
    
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
    this.orderUpdatesSubscription?.unsubscribe();
    this.stockUpdatesSubscription?.unsubscribe();
    this.reservationUpdatesSubscription?.unsubscribe();
    this.cajaUpdatesSubscription?.unsubscribe();
    if (this.reservationTimer) clearTimeout(this.reservationTimer);
    this.liberarReservas();
    if (this.productSearchTimer) clearTimeout(this.productSearchTimer);
    if (this.productAddFrame !== undefined) cancelAnimationFrame(this.productAddFrame);
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

  abrirGestionCajeros(): void {
    const caja = this.cajaActual();
    if (!caja?.puede_cerrar) return;

    this.cajaModalMode.set('gestionar');
    this.isCajaModalOpen.set(true);
    this.isProcessingCaja.set(true);
    this.usuariosSeleccionadosCaja.set((caja.usuarios ?? []).map(usuario => usuario.id));
    this.posService.obtenerUsuariosDisponiblesCaja(caja.id).subscribe({
      next: ({ usuarios }) => {
        this.usuariosDisponiblesCaja.set(usuarios);
        this.isProcessingCaja.set(false);
      },
      error: (err) => {
        this.isProcessingCaja.set(false);
        this.isCajaModalOpen.set(false);
        this.toastr.error(err?.error?.message || 'No se pudo cargar la lista de cajeros.');
      },
    });
  }

  alternarCajeroAutorizado(usuarioId: number, seleccionado: boolean): void {
    this.usuariosSeleccionadosCaja.update(usuarios => seleccionado
      ? [...new Set([...usuarios, usuarioId])]
      : usuarios.filter(id => id !== usuarioId));
  }

  cerrarModalCaja(): void {
    if (!this.isProcessingCaja()) {
      this.isCajaModalOpen.set(false);
    }
  }

  confirmarCaja(): void {
    if (this.cajaModalMode() === 'gestionar') {
      const caja = this.cajaActual();
      if (!caja) return;
      this.isProcessingCaja.set(true);
      this.posService.actualizarUsuariosCaja(caja.id, this.usuariosSeleccionadosCaja()).subscribe({
        next: ({ caja: cajaActualizada }) => {
          this.cajaActual.set({ ...this.cajaActual()!, ...cajaActualizada });
          this.isProcessingCaja.set(false);
          this.isCajaModalOpen.set(false);
          this.toastr.success('Cajeros autorizados actualizados.');
        },
        error: (err) => {
          this.isProcessingCaja.set(false);
          this.toastr.error(err?.error?.message || 'No se pudieron actualizar los cajeros.');
        },
      });
      return;
    }

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
    return formatCurrency(monto);
  }

  onBackRequested(): void {
    const leaveDecision = this.confirmLeave();
    if (typeof leaveDecision === 'boolean') {
      if (leaveDecision) this.leavePos();
      return;
    }
    leaveDecision.subscribe(confirmed => {
      if (confirmed) this.leavePos();
    });
  }

  private leavePos(): void {
    if (this.isCajero()) {
      this.liberarReservas();
      this.auth.logout().subscribe({ error: () => undefined });
      return;
    }
    this.navigateBack();
  }

  confirmLeave() {
    if (this.leaveAlreadyConfirmed) return true;
    if (!this.hasUnsavedChanges()) return true;

    return this.confirmDialog.confirm({
      title: '¿Abandonar pedido?',
      message: 'Tienes un pedido en proceso. Si sales ahora, se perderán todos los productos y cambios sin guardar.',
      confirmText: 'Abandonar pedido',
      confirmColor: 'danger',
    });
  }

  private navigateBack(): void {
    // El guard de la ruta se ejecuta también en esta navegación. Conservamos la
    // decisión ya aprobada para no mostrar el mismo diálogo una segunda vez.
    this.leaveAlreadyConfirmed = true;
    this.liberarReservas();
    this.router.navigate([this.operationMode === 'preorden' ? '/app/servicio' : '/app/pedidos'])
      .then(navigated => {
        if (!navigated) this.leaveAlreadyConfirmed = false;
      });
  }

  onSaveOrderEditsRequested(): void {
    const orderId = this.editingOrderId();
    if (!this.isEditingOrder() || !orderId) {
      return;
    }

    if (!this.selectedCliente()) {
      const message = 'Asigna un cliente antes de guardar los cambios de la orden.';
      this.error.set(message);
      this.toastr.error(message);
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
      fecha_programada: this.preorderDate() ?? null,
      tipo_flujo: this.preorderDate() ? 'preorden' : 'normal',
    };

    const payload = this.posService.mapOrderToPayload(order);

    this.isProcessingCheckout.set(true);
    this.posService.actualizarOrden(orderId, payload, this.expectedOrderVersion()).subscribe({
      next: () => {
        this.toastr.success('Orden actualizada correctamente');
        // Después de guardar cambios salimos del modo edición y limpiamos todo
        this.finalizarVenta();
      },
      error: (err) => {
        if (this.handleOrderVersionConflict(err, orderId)) return;
        this.toastr.error('No se pudo guardar los cambios de la orden');
        this.isProcessingCheckout.set(false);
      },
      complete: () => {
        this.isProcessingCheckout.set(false);
      },
    });
  }

  private cargarOrdenExistente(orderId: number, afterLoaded?: () => void): void {
  this.posService.obtenerOrdenPorId(orderId).subscribe({
    next: (response: any) => {
      const orden = response?.orden;
      if (!orden) {
        this.toastr.error('No se encontró la información de la orden');
        return;
      }
      if (orden.estado === 'cancelado') {
        this.toastr.warning('Esta orden fue cancelada y no puede editarse ni cobrarse nuevamente.');
        return;
      }

      this.editingOrder.set(orden);
      this.editingOrderId.set(orderId);
      this.isEditingOrder.set(true);
      this.orderType.set((orden.tipo_orden as any) || 'dine-in');
      this.orderDate.set(this.normalizeOrderDate(orden.fecha_orden));
      this.preorderDate.set(this.normalizeOrderDate(orden.fecha_programada));
      
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
      const itemsUnidos = this.mergeDuplicateCartItems(items);
      this.carrito.set(itemsUnidos);
      // Guardar copia del carrito original para poder deshacer cambios
      this.originalCarrito.set(JSON.parse(JSON.stringify(itemsUnidos)));
      this.deletedItems.set([]);
      this.isRefundMode.set(false);
      this.productos.set(this.syncProductosConCarrito(this.productos()));
      this.allProductos.set(this.syncProductosConCarrito(this.allProductos(), this.baseStockByProductId()));
      if (this.pendingOrderAction() === 'pay') {
        this.isCheckoutModalOpen.set(true);
      }
      this.pendingOrderAction.set(null);
      afterLoaded?.();
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
        this.toastr.error('Error al cargar categorías');
        this.isLoadingCategorias.set(false);
      },
    });
  }
  
  private cargarProductos(categoriaId?: number, silenciosa = false): void {
    if (!silenciosa) this.isLoadingProductos.set(true);
    this.productoService.listarProductos(categoriaId, this.operationMode === 'pos' ? this.reservationSessionId : undefined).subscribe({
      next: (productos) => {
        const baseStocks = productos.reduce<Record<number, number>>((acc, producto) => {
          acc[producto.id] = producto.maneja_stock ? Math.max(0, producto.stock_disponible ?? producto.stock ?? 0) : Number.MAX_SAFE_INTEGER;
          return acc;
        }, {});

        const mergedStocks = { ...this.baseStockByProductId(), ...baseStocks };
        this.baseStockByProductId.set(mergedStocks);
        this.productos.set(this.syncProductosConCarrito(productos, mergedStocks));
        // La carga inicial ya contiene el catálogo completo. Reutilizarla evita
        // una segunda solicitud idéntica sólo para el buscador global.
        if (categoriaId === undefined) {
          this.allProductos.set(this.syncProductosConCarrito(productos, mergedStocks));
          this.globalProductsLoaded = true;
          this.globalProductLoadCallbacks.splice(0).forEach(callback => callback());
        }
        if (!silenciosa) this.isLoadingProductos.set(false);
        this.error.set(null);
      },
      error: (err) => {
        if (!silenciosa) {
          this.error.set('Error al cargar productos');
          this.toastr.error('Error al cargar productos');
          this.isLoadingProductos.set(false);
        }
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
    const cantidadEnCarrito = this.carrito()
      .filter(item => item.producto.id === producto.id)
      .reduce((total, item) => total + item.cantidad, 0);
    const pendiente = this.pendingProductAdds.get(producto.id)?.cantidad ?? 0;
    const stockBase = this.baseStockByProductId()[producto.id] ?? producto.stock ?? 0;

    // Reservamos el stock antes del siguiente cuadro para que una ráfaga de clics
    // no pueda agregar más unidades de las disponibles.
    if (producto.maneja_stock && cantidadEnCarrito + pendiente >= stockBase) return;

    this.pendingProductAdds.set(producto.id, { producto, cantidad: pendiente + 1 });
    if (this.productAddFrame !== undefined) return;

    this.productAddFrame = requestAnimationFrame(() => this.flushPendingProductAdds());
  }

  private flushPendingProductAdds(): void {
    this.productAddFrame = undefined;
    const additions = [...this.pendingProductAdds.values()];
    this.pendingProductAdds.clear();
    if (!additions.length) return;

    const carrito = [...this.carrito()];
    const stockDeltas = new Map<number, number>();

    additions.forEach(({ producto, cantidad }) => {
      const existingItem = carrito.find(item => item.producto.id === producto.id && !item.isModifierVariant);
      if (existingItem) {
        existingItem.cantidad += cantidad;
        const extras = (existingItem.modificadores || []).reduce(
          (sum, mod) => sum + parseFloat(mod.precio_extra.toString()), 0
        );
        existingItem.subtotal = existingItem.cantidad * (existingItem.precio_unitario + extras);
      } else {
        const modificadores = this.getDefaultModifiers(producto);
        const precio = parseFloat(producto.precio.toString());
        const extras = modificadores.reduce((sum, mod) => sum + parseFloat(mod.precio_extra.toString()), 0);
        carrito.push({
          id: Date.now() + Math.floor(Math.random() * 100000),
          producto,
          cantidad,
          precio_unitario: precio,
          subtotal: (precio + extras) * cantidad,
          modificadores,
        });
      }

      if (producto.maneja_stock) {
        stockDeltas.set(producto.id, (stockDeltas.get(producto.id) ?? 0) - cantidad);
      }
    });

    this.carrito.set(this.mergeDuplicateCartItems(carrito));
    this.updateProductStocks(stockDeltas);
  }

  private getDefaultModifiers(producto: Producto): CartItemModificador[] {
    const modificadores: CartItemModificador[] = [];
    (producto.modificadores || []).forEach(grupo => {
      grupo.opciones?.forEach(opcion => {
        if (opcion.predeterminado && opcion.activo !== false) {
          modificadores.push({
            modificador_id: grupo.id,
            opcion_id: opcion.id,
            opcion_nombre: opcion.nombre,
            precio_extra: parseFloat(opcion.precio_extra.toString()),
          });
        }
      });
    });
    return modificadores;
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
      this.carrito.set(this.mergeDuplicateCartItems(carrito));

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
      this.carrito.set(this.mergeDuplicateCartItems(carrito));
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

    this.carrito.set(this.mergeDuplicateCartItems(nextCarrito));
  }

  onModifierModalClosed(): void {
    this.carrito.set(this.mergeDuplicateCartItems(this.carrito()));
  }

  private mergeDuplicateCartItems(items: CartItem[]): CartItem[] {
    const merged: CartItem[] = [];
    const seen = new Map<string, CartItem>();

    items.forEach((item) => {
      const key = [
        item.producto?.id,
        Number(item.precio_unitario ?? 0).toFixed(2),
        item.nota?.trim() || '',
        (item.modificadores || [])
          .map((mod) => `${mod.modificador_id}:${mod.opcion_id}:${Number(mod.precio_extra ?? 0).toFixed(2)}`)
          .sort()
          .join('|'),
      ].join('::');

      const existing = seen.get(key);
      if (existing) {
        existing.cantidad += item.cantidad;
        if (!existing.orden_detalle_id && item.orden_detalle_id) {
          existing.orden_detalle_id = item.orden_detalle_id;
        }
        existing.isModifierVariant = !!existing.isModifierVariant && !!item.isModifierVariant;
        if (!existing.isModifierVariant) {
          existing.parentItemId = undefined;
        }
        const extras = (existing.modificadores || []).reduce(
          (sum, mod) => sum + Number(mod.precio_extra ?? 0),
          0,
        );
        existing.subtotal = existing.cantidad * (Number(existing.precio_unitario) + extras);
        return;
      }

      const clonedItem: CartItem = {
        ...item,
        modificadores: (item.modificadores || []).map((mod) => ({ ...mod })),
      };
      const extras = (clonedItem.modificadores || []).reduce((sum, mod) => sum + Number(mod.precio_extra ?? 0), 0);
      clonedItem.subtotal = clonedItem.cantidad * (Number(clonedItem.precio_unitario) + extras);
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
    this.preorderDate.set(null);
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
    
    // "Cambiar" solo debe liberar el cliente para elegir otro;
    // una edición de orden conserva sus productos y el resto de cambios.
    if (cliente === null) {
      this.selectedCliente.set(null);
      return;
    }

    this.selectedCliente.set(cliente);
  }

  onOrderDateChanged(value: string | null): void {
    this.orderDate.set(this.normalizeOrderDate(value));
  }

  onReservationDateChanged(value: string | null): void {
    this.preorderDate.set(this.normalizeOrderDate(value));
  }

  onItemNoteChanged(data: { itemId: number; nota: string }): void {
    const carrito = this.carrito();
    const item = carrito.find((i) => i.id === data.itemId);
    if (item) {
      item.nota = data.nota;
      this.carrito.set(this.mergeDuplicateCartItems(carrito));
    }
  }

  private hasOrderEditsForUpdate(): boolean {
    const original = this.editingOrder();
    if (!original) return true;

    const originalClientId = original.cliente_id ?? null;
    const originalMesaId = original.mesa_id ?? original.mesa?.id ?? null;

    return this.orderType() !== original.tipo_orden
      || (this.selectedCliente()?.id ?? null) !== originalClientId
      || (this.selectedMesa()?.id ?? null) !== originalMesaId
      || this.orderDate() !== this.normalizeOrderDate(original.fecha_orden)
      || this.preorderDate() !== this.normalizeOrderDate(original.fecha_programada)
      || this.cartFingerprint(this.carrito()) !== this.cartFingerprint(this.originalCarrito());
  }

  private cartFingerprint(items: CartItem[]): string {
    return JSON.stringify(items.map(item => ({
      producto: item.producto.id,
      cantidad: item.cantidad,
      precio: Number(item.precio_unitario),
      nota: item.nota?.trim() || '',
      modificadores: (item.modificadores || [])
        .map(mod => [mod.modificador_id, mod.opcion_id, Number(mod.precio_extra)])
        .sort((a, b) => a.join(':').localeCompare(b.join(':'))),
    })));
  }

  onCheckoutRequested(): void {
    if (this.operationMode === 'preorden') {
      this.saveProgrammedPreorder();
      return;
    }
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
      fecha_programada: this.preorderDate() ?? null,
      tipo_flujo: this.preorderDate() ? 'preorden' : 'normal',
    };

    if (this.isEditingOrder() && this.editingOrderId()) {
      const orderId = this.editingOrderId()!;
      this.posService.actualizarOrden(orderId, this.posService.mapOrderToPayload(order), this.expectedOrderVersion()).subscribe({
        next: () => {
          this.finalizarVenta();
          this.isProcessingCheckout.set(false);
          this.isEditingOrder.set(false);
          this.editingOrderId.set(null);
          this.mostrarExito('Orden adeudada actualizada exitosamente');
        },
        error: (err) => {
          if (this.handleOrderVersionConflict(err, orderId)) return;
          this.error.set('Error al actualizar la orden adeudada');
          this.toastr.error('Error al actualizar la orden adeudada');
          this.isProcessingCheckout.set(false);
        },
      });
    } else {
      this.posService.crearOrden(order, this.orderReservationSession()).subscribe({
        next: (response) => {
          this.finalizarVenta();
          this.isProcessingCheckout.set(false);
          this.mostrarExito('Orden adeudada creada exitosamente');
        },
        error: () => {
          this.error.set('Error al procesar la orden adeudada');
          this.toastr.error('Error al procesar la orden adeudada');
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
    this.preorderDate.set(this.operationMode === 'preorden' ? this.defaultPreorderDate() : null);
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

      // Una orden sin productos no se "edita": se cancela conservando el historial
      // y registrando la devolución en una sola operación del servidor.
      if (this.carrito().length === 0) {
        const montoEsperado = Math.round((this.refundAmount() + Number.EPSILON) * 100) / 100;
        const montoIngresado = Math.round((montoRecibido + Number.EPSILON) * 100) / 100;
        if (montoIngresado !== montoEsperado) {
          const mensaje = `Para cancelar la venta debes devolver ${formatCurrency(montoEsperado)}.`;
          this.error.set(mensaje);
          this.toastr.warning(mensaje);
          this.isProcessingCheckout.set(false);
          return;
        }
        this.cancelarOrdenCompleta(data.metodoPago);
        return;
      }

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
        fecha_programada: this.preorderDate() ?? null,
        tipo_flujo: this.preorderDate() ? 'preorden' : 'normal',
      };

      const payload = this.posService.mapOrderToPayload(order);

      // 1. Primero actualizamos la orden
      this.posService.actualizarOrden(orderId, payload, this.expectedOrderVersion()).subscribe({
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
              this.toastr.error('Error al registrar la devolución');
              this.isProcessingCheckout.set(false);
            },
          });
        },
        error: (err) => {
          if (this.handleOrderVersionConflict(err, orderId)) return;
          console.error('Error al actualizar la orden:', err);
          this.error.set('Error al actualizar la orden');
          this.toastr.error('Error al actualizar la orden');
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
      fecha_programada: this.preorderDate() ?? null,
      tipo_flujo: this.preorderDate() ? 'preorden' : 'normal',
    };

    if (this.isEditingOrder() && this.editingOrderId()) {
      const orderId = this.editingOrderId()!;
      const registrarPago = () => this.posService.crearPagoOrden({
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
          this.mostrarExito('Pago registrado exitosamente');
        },
        error: (err) => {
          const message = err?.error?.error || err?.error?.message || 'Error al registrar el pago';
          this.error.set(message);
          this.toastr.error(message);
          this.isProcessingCheckout.set(false);
        },
      });

      // Un abono de deuda no modifica la orden. Evitamos un PUT innecesario que
      // podría bloquear el pago por validaciones ajenas al importe recibido.
      if (!this.hasOrderEditsForUpdate()) {
        registrarPago();
        return;
      }

      this.posService.actualizarOrden(orderId, this.posService.mapOrderToPayload(order), this.expectedOrderVersion()).subscribe({
        next: registrarPago,
        error: err => {
          if (this.handleOrderVersionConflict(err, orderId)) return;
          const message = err?.error?.error || err?.error?.message || 'Error al actualizar la orden';
          this.error.set(message);
          this.toastr.error(message);
          this.isProcessingCheckout.set(false);
        },
      });
    } else {
      // Crear nueva orden y luego registrar pago
      //const createPayload = this.posService.mapOrderToPayload(order);
      //console.log('Creating order payload:', createPayload);
      this.posService.crearOrden(order, this.orderReservationSession()).subscribe({
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
                this.toastr.error('Error al registrar el pago');
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
          this.toastr.error('Error al procesar la venta');
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

  onCancelTodayOrder(orderId: number): void {
    this.confirmOrderReplacement(() => {
      this.confirmDialog.confirm({
        title: '¿Cancelar orden?',
        message: 'La orden conservará su historial. Si tiene pagos, se registrará una devolución antes de cancelarla.',
        confirmText: 'Continuar',
        confirmColor: 'danger',
      }).subscribe(confirmed => {
        if (!confirmed) return;

        this.prepareOrderSelection('pending', 'edit');
        this.closeTodayOrdersModal();
        this.closeTodayOrderDetail();
        this.cargarOrdenExistente(orderId, () => {
          // Mostrar los productos como devolución en el modal sin borrar evidencia de la orden.
          this.deletedItems.set(JSON.parse(JSON.stringify(this.originalCarrito())));
          this.carrito.set([]);

          if (this.paidAmount() > 0) {
            this.isRefundMode.set(true);
            this.isCheckoutModalOpen.set(true);
            return;
          }

          this.cancelarOrdenCompleta();
        });
      });
    });
  }

  private cancelarOrdenCompleta(metodoPago?: PaymentMethodType): void {
    const orderId = this.editingOrderId();
    if (!orderId) return;

    this.isProcessingCheckout.set(true);
    this.posService.cancelarVenta(orderId, this.expectedOrderVersion(), metodoPago).subscribe({
      next: () => {
        this.finalizarVenta();
        this.isCheckoutModalOpen.set(false);
        this.isProcessingCheckout.set(false);
        this.mostrarExito('Orden cancelada correctamente.');
      },
      error: err => {
        if (this.handleOrderVersionConflict(err, orderId)) return;
        const mensaje = err?.error?.message || err?.error?.error || 'No se pudo cancelar la orden.';
        this.error.set(mensaje);
        this.toastr.error(mensaje);
        this.isProcessingCheckout.set(false);
      },
    });
  }

  private applyRemoteStock(productId: number, stock: number): void {
    const baseStocks = { ...this.baseStockByProductId(), [productId]: Math.max(0, stock) };
    this.baseStockByProductId.set(baseStocks);
    const actualizar = (productos: Producto[]) => productos.map(producto => producto.id === productId
      ? { ...producto, stock: Math.max(0, stock) }
      : producto);
    this.productos.set(this.syncProductosConCarrito(actualizar(this.productos()), baseStocks));
    this.allProductos.set(this.syncProductosConCarrito(actualizar(this.allProductos()), baseStocks));
  }

  private expectedOrderVersion(): number {
    return this.editingOrder()?.version ?? 1;
  }

  private handleOrderVersionConflict(error: any, orderId: number): boolean {
    if (error?.status !== 409) return false;
    this.isProcessingCheckout.set(false);
    this.confirmDialog.confirm({
      title: 'Orden modificada',
      message: 'Otro cajero guardó cambios en esta orden. Actualízala para revisarlos antes de volver a guardar.',
      confirmText: 'Actualizar orden',
      cancelText: 'Seguir revisando',
    }).subscribe(actualizar => {
      if (actualizar) this.cargarOrdenExistente(orderId);
    });
    return true;
  }

  private createReservationSessionId(reset = false): string {
    const key = 'pos-reservation-session-id';
    const existing = !reset ? sessionStorage.getItem(key) : null;
    if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) return existing;
    const id = crypto.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
      const value = Math.floor(Math.random() * 16);
      return (character === 'x' ? value : (value & 0x3) | 0x8).toString(16);
    });
    sessionStorage.setItem(key, id);
    return id;
  }

  private reservationItems(): Array<{ producto_id: number; cantidad: number }> {
    const quantities = new Map<number, number>();
    this.carrito().forEach(item => {
      if (!item.producto?.maneja_stock) return;
      quantities.set(item.producto.id, (quantities.get(item.producto.id) ?? 0) + item.cantidad);
    });
    return [...quantities].map(([producto_id, cantidad]) => ({ producto_id, cantidad }));
  }

  private scheduleReservationSync(items: Array<{ producto_id: number; cantidad: number }>): void {
    this.reservationDirty = true;
    if (this.reservationTimer) clearTimeout(this.reservationTimer);
    this.reservationTimer = setTimeout(() => this.syncReservations(items), 180);
  }

  private syncReservations(items: Array<{ producto_id: number; cantidad: number }>): void {
    if (this.isEditingOrder()) return;
    if (this.reservationSyncing) return;
    this.reservationSyncing = true;
    this.reservationDirty = false;
    this.productoService.sincronizarReservasStock(this.reservationSessionId, items).subscribe({
      next: () => {
        this.reservationSyncing = false;
        if (this.reservationDirty) this.scheduleReservationSync(this.reservationItems());
      },
      error: err => {
        this.reservationSyncing = false;
        const productId = Number(err?.error?.producto_id);
        if (productId) this.capReservedProduct(productId, Number(err?.error?.cantidad_reservada ?? 0));
        if (productId) this.toastr.warning(err?.error?.message || 'No se pudo reservar el stock seleccionado.');
        this.cargarProductos(this.selectedSubcategoryId() ?? this.selectedCategoryId() ?? undefined);
        if (this.reservationDirty) this.scheduleReservationSync(this.reservationItems());
      },
    });
  }

  private capReservedProduct(productId: number, permitted: number): void {
    let remaining = Math.max(0, permitted);
    const items = this.carrito().map(item => {
      if (item.producto.id !== productId) return item;
      const cantidad = Math.min(item.cantidad, remaining);
      remaining -= cantidad;
      const extras = (item.modificadores || []).reduce((sum, mod) => sum + Number(mod.precio_extra), 0);
      return { ...item, cantidad, subtotal: cantidad * (Number(item.precio_unitario) + extras) };
    }).filter(item => item.cantidad > 0);
    this.carrito.set(this.mergeDuplicateCartItems(items));
  }

  private liberarReservas(): void {
    if (this.operationMode !== 'pos') return;
    const sessionId = this.reservationSessionId;
    this.reservationSessionId = this.createReservationSessionId(true);
    this.productoService.liberarReservasStock(sessionId).subscribe({ error: () => undefined });
  }

  private orderReservationSession(): string | undefined {
    return this.operationMode === 'pos' ? this.reservationSessionId : undefined;
  }

  private finalizarVenta(): void {
    this.liberarReservas();
    this.carrito.set([]);
    this.originalCarrito.set([]);
    this.deletedItems.set([]);
    this.isRefundMode.set(false);
    this.selectedCategoryId.set(null);
    this.selectedSubcategoryId.set(null);
    this.selectedCliente.set(null);
    this.selectedMesa.set(null);
    this.orderDate.set(null);
    this.preorderDate.set(null);
    this.isEditingOrder.set(false);
    this.editingOrderId.set(null);
    this.editingOrderSource.set(null);
    this.pendingOrderAction.set(null);
    this.cargarProductos();
    this.refreshOrderLists(true, true);
    this.cargarCajaActual();
  }

  private saveProgrammedPreorder(): void {
    if (!this.selectedCliente()) {
      this.toastr.error('Selecciona un cliente para guardar la preorden.');
      return;
    }
    if (!this.preorderDate()) {
      this.toastr.error('Selecciona la fecha y hora programadas.');
      return;
    }
    if (this.carrito().length === 0) {
      this.toastr.error('Agrega al menos un producto.');
      return;
    }

    const order: Order = {
      id: 0,
      items: this.carrito(),
      subtotal: this.subtotal(),
      total: this.total(),
      metodo_pago: 'efectivo',
      estado: 'adeudado',
      cliente_id: this.selectedCliente()!.id,
      cliente_nombre: this.selectedCliente()!.nombre,
      cliente_telefono: this.selectedCliente()!.telefono,
      tipo_orden: this.orderType(),
      mesa_id: this.selectedMesa()?.id,
      fecha_orden: this.orderDate() ?? null,
      fecha_programada: this.preorderDate(),
      tipo_flujo: 'preorden',
    };

    this.isProcessingCheckout.set(true);
    this.posService.crearOrden(order, this.orderReservationSession()).subscribe({
      next: () => {
        this.isProcessingCheckout.set(false);
        this.carrito.set([]);
        this.selectedCliente.set(null);
        this.selectedMesa.set(null);
        this.preorderDate.set(this.defaultPreorderDate());
        this.toastr.success('Preorden programada correctamente.');
        this.router.navigate(['/app/servicio']);
      },
      error: error => {
        this.isProcessingCheckout.set(false);
        this.toastr.error(error?.error?.message || 'No se pudo guardar la preorden.');
      },
    });
  }

  private defaultPreorderDate(): string {
    const date = new Date(Date.now() + 15 * 60 * 1000);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
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
    if (this.productSearchTimer) clearTimeout(this.productSearchTimer);
    if (!query.trim()) return;
    if (!this.globalProductsLoaded) {
      this.cargarCatalogoGlobal(false, () => this.programarAutoSeleccion(query));
      return;
    }
    this.programarAutoSeleccion(query);
  }

  selectGlobalProduct(producto: Producto): void {
    if (!producto.activo || (producto.maneja_stock && (producto.stock ?? 0) <= 0)) return;
    this.onProductAdded(producto);
    this.productSearchQuery.set('');
  }

  openProductSelector(): void {
    this.isProductSelectorOpen.set(true);
  }

  toggleMobileActions(): void {
    this.isMobileActionsOpen.update(open => !open);
  }

  openMobilePendingOrders(): void {
    this.isMobileActionsOpen.set(false);
    this.onPendingOrdersRequested();
  }

  openMobilePreorders(): void {
    this.isMobileActionsOpen.set(false);
    this.onPreordersRequested();
  }

  openMobileCaja(): void {
    this.isMobileActionsOpen.set(false);
    const caja = this.cajaActual();
    if (caja && !caja.puede_cerrar) {
      this.toastr.info(`Usas la caja compartida de ${caja.user?.name ?? 'otro cajero'}.`);
      return;
    }
    this.abrirModalCaja(caja ? 'cerrar' : 'abrir');
  }

  async toggleMobileFullscreen(): Promise<void> {
    this.isMobileActionsOpen.set(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      this.toastr.info('El navegador no permitió cambiar la pantalla completa.');
    }
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

  onTodayOrdersRequested(): void {
    this.loadOrders();
    this.todayOrdersSearch.set('');
    this.isTodayOrdersModalOpen.set(true);
  }

  closeTodayOrdersModal(): void {
    this.isTodayOrdersModalOpen.set(false);
    this.todayOrdersSearch.set('');
  }

  openTodayOrderDetail(orden: Order): void {
    this.todayOrderDetail.set(orden);
    this.todayOrderRemovedItems.set([]);
    this.posService.obtenerHistorialOrden(orden.id).subscribe({
      next: historial => {
        const agrupados = new Map<string, { key: string; nombre: string; cantidad: number; subtotal: number }>();
        historial.filter(cambio => cambio.tipo_cambio === 'detalle_eliminado').forEach(cambio => {
          const datos = cambio.datos_anterior ?? {};
          const nombre = cambio.producto?.nombre ?? datos.producto_nombre ?? 'Producto';
          const cantidad = Number(cambio.cantidad_anterior ?? datos.cantidad ?? 0);
          const precio = Number(datos.precio_unitario ?? 0);
          const key = `${cambio.producto_id ?? datos.producto_id ?? nombre}::${precio}`;
          const existente = agrupados.get(key);
          if (existente) { existente.cantidad += cantidad; existente.subtotal += precio * cantidad; return; }
          agrupados.set(key, { key, nombre, cantidad, subtotal: precio * cantidad });
        });
        this.todayOrderRemovedItems.set([...agrupados.values()]);
      },
    });
  }

  closeTodayOrderDetail(): void {
    this.todayOrderDetail.set(null);
    this.todayOrderRemovedItems.set([]);
  }

  abrirModalGasto(): void {
    if (!this.cajaActual()?.puede_cerrar) return;
    this.gastoCategoria.set('INSUMOS');
    this.gastoConcepto.set('');
    this.gastoMonto.set('');
    this.isGastoModalOpen.set(true);
  }

  cerrarModalGasto(): void {
    if (!this.isProcessingGasto()) this.isGastoModalOpen.set(false);
  }

  confirmarGasto(): void {
    const monto = Number(this.gastoMonto());
    const concepto = this.gastoConcepto().trim();
    if (!Number.isFinite(monto) || monto <= 0) {
      this.toastr.error('Ingresa un monto válido.');
      return;
    }
    this.isProcessingGasto.set(true);
    this.posService.registrarGastoCaja({ categoria: this.gastoCategoria(), concepto: concepto || null, monto }).subscribe({
      next: () => {
        this.isProcessingGasto.set(false);
        this.isGastoModalOpen.set(false);
        this.cargarCajaActual();
        this.toastr.success('Gasto registrado y descontado de la caja.');
      },
      error: (err) => {
        this.isProcessingGasto.set(false);
        this.toastr.error(err?.error?.message || Object.values(err?.error?.errors ?? {}).flat().join(' ') || 'No se pudo registrar el gasto.');
      },
    });
  }

  onEditTodayOrder(orderId: number): void {
    this.confirmOrderReplacement(() => {
      this.prepareOrderSelection('pending', 'edit');
      this.closeTodayOrdersModal();
      this.closeTodayOrderDetail();
      this.cargarOrdenExistente(orderId);
    });
  }

  onPayTodayOrder(orderId: number): void {
    this.confirmOrderReplacement(() => {
      this.prepareOrderSelection('pending', 'pay');
      this.closeTodayOrdersModal();
      this.closeTodayOrderDetail();
      this.cargarOrdenExistente(orderId);
    });
  }

  closePendingOrdersModal(): void {
    this.isPendingOrdersModalOpen.set(false);
  }

  onPreordersRequested(): void {
    this.loadPreorders();
    this.isPreordersModalOpen.set(true);
  }

  closePreordersModal(): void {
    this.isPreordersModalOpen.set(false);
    this.preordersSearch.set('');
  }

  onEditPreorder(orderId: number): void {
    this.confirmOrderReplacement(() => {
      this.prepareOrderSelection('pending', 'edit');
      this.closePreordersModal();
      this.cargarOrdenExistente(orderId);
    });
  }

  onActivatePreorder(order: Order): void {
    this.confirmDialog.confirm({
      title: 'Activar preorden',
      message: `¿Activar la preorden #${order.numero_orden || order.id}? Entrará inmediatamente a Cocina, Parrilla y Servicio.`,
      confirmText: 'Activar',
      confirmColor: 'primary',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.posService.activarPreorden(order.id).subscribe({
        next: () => {
          this.toastr.success('Preorden activada correctamente.');
          this.loadPreorders();
          this.loadOrders();
        },
        error: error => this.toastr.error(error?.error?.message || 'No se pudo activar la preorden.'),
      });
    });
  }

  onExistingOrderSelected(orderId: number): void {
    this.confirmOrderReplacement(() => {
      this.prepareOrderSelection('internal', 'edit');
      this.cargarOrdenExistente(orderId);
    });
  }

  onEditPendingOrder(orderId: number): void {
    this.confirmOrderReplacement(() => {
      this.prepareOrderSelection('pending', 'edit');
      this.closePendingOrdersModal();
      this.cargarOrdenExistente(orderId);
    });
  }

  onPayPendingOrder(orderId: number): void {
    this.confirmOrderReplacement(() => {
      this.prepareOrderSelection('pending', 'pay');
      this.closePendingOrdersModal();
      this.cargarOrdenExistente(orderId);
    });
  }

  private confirmOrderReplacement(onConfirmed: () => void): void {
    if (!this.hasUnsavedChanges()) {
      onConfirmed();
      return;
    }

    this.confirmDialog.confirm({
      title: '¿Cambiar de pedido?',
      message: 'Tienes un pedido en proceso. Al abrir otra orden se perderán los productos y cambios sin guardar.',
      confirmText: 'Abrir otra orden',
      confirmColor: 'danger',
    }).subscribe(confirmed => {
      if (confirmed) onConfirmed();
    });
  }

  private prepareOrderSelection(source: 'pending' | 'internal', action: 'edit' | 'pay'): void {
    if (this.isEditingOrder()) this.resetOrderSelection();
    this.editingOrderSource.set(source);
    this.pendingOrderAction.set(action);
  }

  private resetOrderSelection(): void {
    this.liberarReservas();
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
    this.preorderDate.set(this.operationMode === 'preorden' ? this.defaultPreorderDate() : null);
    this.deletedItems.set([]);
    this.isRefundMode.set(false);
  }

  loadPendingOrders(resetSearch = true): void {
    this.refreshOrderLists(resetSearch, false);
  }

  private loadOrders(): void {
    this.refreshOrderLists();
  }

  private isPendingOrder(orden: Order): boolean {
    if (orden.fecha_orden?.slice(0, 10) !== this.getTodayDateString()) {
      return false;
    }
    if (orden.tipo_flujo === 'preorden' && orden.estado_preorden === 'programada') {
      return false;
    }
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
    return formatCurrency(amount);
  }

  private loadPreorders(): void {
    this.refreshOrderLists(false, true);
  }

  /**
   * POS necesita las mismas órdenes para el carrito, pendientes y preórdenes.
   * Se consulta una sola vez y se reparten localmente, incluso si varias acciones
   * piden actualizar las listas al mismo tiempo.
   */
  private refreshOrderLists(resetPendingSearch = false, resetPreordersSearch = false): void {
    this.resetPendingSearchOnOrderLoad ||= resetPendingSearch;
    this.resetPreordersSearchOnOrderLoad ||= resetPreordersSearch;
    if (this.isLoadingOrderLists) return;

    this.isLoadingOrderLists = true;
    this.posService.obtenerOrdenes().subscribe({
      next: (ordenes) => {
        this.orders.set(ordenes);
        this.pendingOrders.set(ordenes.filter((orden) => this.isPendingOrder(orden)));
        this.preorders.set(ordenes.filter((orden) =>
          orden.tipo_flujo === 'preorden' && orden.estado_preorden === 'programada'
        ));
        if (this.resetPendingSearchOnOrderLoad) this.pendingOrdersSearch.set('');
        if (this.resetPreordersSearchOnOrderLoad) this.preordersSearch.set('');
      },
      error: () => {
        this.orders.set([]);
        this.pendingOrders.set([]);
        this.preorders.set([]);
      },
      complete: () => {
        this.isLoadingOrderLists = false;
        this.resetPendingSearchOnOrderLoad = false;
        this.resetPreordersSearchOnOrderLoad = false;
      },
    });
  }

  private updateProductStock(productId: number, delta: number): void {
    this.updateProductStocks(new Map([[productId, delta]]));
  }

  private updateProductStocks(deltas: Map<number, number>): void {
    if (!deltas.size) return;
    const actualizar = (productos: Producto[]) => productos.map(producto => {
      const delta = deltas.get(producto.id);
      return delta !== undefined && producto.maneja_stock
        ? { ...producto, stock: Math.max(0, (producto.stock ?? 0) + delta) }
        : producto;
    });
    this.productos.set(actualizar(this.productos()));
    this.allProductos.set(actualizar(this.allProductos()));
  }

  private cargarCatalogoGlobal(force = false, onLoaded?: () => void): void {
    if (this.globalProductsLoaded && !force) { onLoaded?.(); return; }
    if (onLoaded) this.globalProductLoadCallbacks.push(onLoaded);
    if (this.isLoadingGlobalProducts()) return;
    this.isLoadingGlobalProducts.set(true);
    this.productoService.listarProductos(undefined, this.operationMode === 'pos' ? this.reservationSessionId : undefined).subscribe({
      next: productos => {
        const stocks = productos.reduce<Record<number, number>>((acc, producto) => {
          acc[producto.id] = producto.maneja_stock ? Math.max(0, producto.stock_disponible ?? producto.stock ?? 0) : Number.MAX_SAFE_INTEGER;
          return acc;
        }, {});
        const mergedStocks = { ...this.baseStockByProductId(), ...stocks };
        this.baseStockByProductId.set(mergedStocks);
        this.allProductos.set(this.syncProductosConCarrito(productos, mergedStocks));
        this.globalProductsLoaded = true;
        this.isLoadingGlobalProducts.set(false);
        this.globalProductLoadCallbacks.splice(0).forEach(callback => callback());
      },
      error: () => {
        this.isLoadingGlobalProducts.set(false);
        this.globalProductLoadCallbacks = [];
      },
    });
  }

  private programarAutoSeleccion(query: string): void {
    this.productSearchTimer = setTimeout(() => {
      if (this.productSearchQuery().trim().toLowerCase() !== query.trim().toLowerCase()) return;
      const resultados = this.globalSearchResults();
      if (resultados.length === 1) this.selectGlobalProduct(resultados[0]);
    }, 350);
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

    if (/^\d{4}-\d{2}-\d{2}T\d{1,2}:\d{2}(?::\d{2})?$/.test(normalized)) {
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
