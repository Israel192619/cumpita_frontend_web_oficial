import { Component, signal, computed, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { CartItem, CartItemModificador, Order, PaymentMethodOption, PosService, ClienteSearch, Mesa } from '../../services';
import { Categoria } from '../../../../core/models/categoria';
import { Producto } from '../../../../core/models/producto';
import { CartPanelComponent, CategoryBarComponent, CheckoutModalComponent, PaymentMethodType, ProductGridComponent } from '../../components';
import { CategoriaService } from '../../../categorias/services/categoria-service';
import { ProductoService } from '../../../productos/services/producto-service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-pos-home',
  standalone: true,
  imports: [  
    CommonModule,
    CategoryBarComponent,
    ProductGridComponent,
    CartPanelComponent,
    CheckoutModalComponent,
  ],
  templateUrl: './pos-home.html',
  styleUrl: './pos-home.css',
})
export class PosHome implements OnInit {
  categorias = signal<Categoria[]>([]);
  productos = signal<Producto[]>([]);
  carrito = signal<CartItem[]>([]);
  baseStockByProductId = signal<Record<number, number>>({});
  productSearchQuery = signal<string>('');
  isLoadingCategorias = signal<boolean>(true);
  isLoadingProductos = signal<boolean>(false);
  isCheckoutModalOpen = signal<boolean>(false);
  isProcessingCheckout = signal<boolean>(false);
  error = signal<string | null>(null);
  isEditingOrder = signal<boolean>(false);
  editingOrderId = signal<number | null>(null);

  selectedCategoryId = signal<number | null>(null);
  selectedSubcategoryId = signal<number | null>(null);
  orderType = signal<'dine-in' | 'to-go' | 'delivery'>('dine-in');
  selectedCliente = signal<ClienteSearch | null>(null);
  selectedMesa = signal<Mesa | null>(null);
  orderDate = signal<string | null>(null);
  
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

  ngOnInit(): void {
    this.cargarCategorias();
    this.cargarProductos();
    
    // Verificar si viene un ID de orden para editar
    this.route.queryParams.subscribe(params => {
      const orderId = params['orderId'];
      const isEdit = params['edit'] === 'true';
      
      if (orderId && isEdit) {
        this.cargarOrdenExistente(parseInt(orderId));
      }
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

      this.editingOrderId.set(orderId);
      this.isEditingOrder.set(true);
      this.orderType.set((orden.tipo_orden as any) || 'dine-in');
      this.orderDate.set(this.normalizeOrderDate(orden.fecha_orden));
      
      // Cargar cliente y mesa si existen
      if (orden.cliente) {
        this.selectedCliente.set({ id: orden.cliente_id, nombre: orden.cliente.nombre || '' });
      }
      if (orden.mesa_id) {
        this.selectedMesa.set({ id: orden.mesa_id, numero: orden.mesa?.numero || '', capacidad: 0, estado: 'ocupada' });
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
          nota: item.nota || ''
        };
      });

      // Inyectamos los platos reconstruidos directamente en el Signal del carrito
      this.carrito.set(items);
      this.productos.set(this.syncProductosConCarrito(this.productos()));
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
    }
  }

  onItemRemoved(itemId: number): void {
    const carrito = this.carrito();
    const item = carrito.find((currentItem) => currentItem.id === itemId);
    if (item?.producto?.maneja_stock) {
      this.updateProductStock(item.producto.id, item.cantidad);
    }
    this.carrito.set(carrito.filter((item) => item.id !== itemId));
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

  onOrderDateChanged(value: string | null): void {
    this.orderDate.set(this.normalizeOrderDate(value));
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
        error: (err) => {
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
  }

  onCheckoutConfirmed(data: {
    metodoPago: PaymentMethodType;
    clienteId?: number;
    mesaId?: number;
  }): void {
    this.isProcessingCheckout.set(true);

    if (!this.selectedCliente() && !data.clienteId) {
      this.error.set('Selecciona un cliente para continuar con la venta.');
      this.toastr.error('Selecciona un cliente para continuar con la venta.');
      this.isProcessingCheckout.set(false);
      return;
    }

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
    };

    if (this.isEditingOrder() && this.editingOrderId()) {
      const orderId = this.editingOrderId()!;
      this.posService.actualizarOrden(orderId, this.posService.mapOrderToPayload(order)).subscribe({
        next: () => {
          this.finalizarVenta();
          this.isCheckoutModalOpen.set(false);
          this.isProcessingCheckout.set(false);
          this.isEditingOrder.set(false);
          this.editingOrderId.set(null);
          this.mostrarExito('Orden actualizada y pagada exitosamente');
        },
        error: () => {
          this.error.set('Error al actualizar la orden');
          this.isProcessingCheckout.set(false);
        },
      });
    } else {
      // Crear nueva orden
      this.posService.crearOrden(order).subscribe({
        next: (response) => {
          this.finalizarVenta();
          this.isCheckoutModalOpen.set(false);
          this.isProcessingCheckout.set(false);
          this.mostrarExito('Venta completada exitosamente');
        },
        error: (err) => {
          this.error.set('Error al procesar la venta');
          this.isProcessingCheckout.set(false);
        },
      });
    }
  }

  onCheckoutCancelled(): void {
    this.isCheckoutModalOpen.set(false);
  }

  onStockAdjusted(): void {
    this.cargarProductos(this.selectedSubcategoryId() ?? this.selectedCategoryId() ?? undefined);
  }

  private finalizarVenta(): void {
    console.log('Venta finalizada, limpiando estado...');
    this.carrito.set([]);
    this.selectedCategoryId.set(null);
    this.selectedSubcategoryId.set(null);
    this.selectedCliente.set(null);
    this.selectedMesa.set(null);
    this.orderDate.set(null);
    this.isEditingOrder.set(false);
    this.editingOrderId.set(null);
    this.cargarProductos();
  }

  private mostrarExito(mensaje: string): void {
    this.toastr.success(mensaje, 'Éxito');
  }

  onCancelEditMode(): void {
    this.isEditingOrder.set(false);
    this.editingOrderId.set(null);
    this.carrito.set([]);
    this.selectedCliente.set(null);
    this.selectedMesa.set(null);
    this.orderDate.set(null);
    this.router.navigate(['/app/pedidos']);
  }

  onProductSearchChanged(query: string): void {
    this.productSearchQuery.set(query);
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

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return `${normalized}T00:00`;
    }

    if (/^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}$/.test(normalized)) {
      return normalized.replace(' ', 'T');
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{1,2}:\d{2}/.test(normalized)) {
      return normalized.slice(0, 16);
    }

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      const hours = String(parsed.getHours()).padStart(2, '0');
      const minutes = String(parsed.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    return null;
  }

  // ==================== HELPERS ====================
  trackByCategoria = (index: number, cat: Categoria) => cat.id;
}
