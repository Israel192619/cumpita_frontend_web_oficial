import { Component, signal, computed, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
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

  cartItemCount = computed(() => {
    return this.carrito().reduce((sum, item) => sum + item.cantidad, 0);
  });

  constructor(
    private posService: PosService, 
    private categoriaService: CategoriaService, 
    private productoService: ProductoService,
    private toastr: ToastrService,
    private route: ActivatedRoute
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
          modificadores: modificadoresMapeados
        };
      });

      // Inyectamos los platos reconstruidos directamente en el Signal del carrito
      this.carrito.set(items);
      this.toastr.info(`Editando orden #${orderId}`);
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
        this.productos.set(productos);
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
  
  // 1. Buscamos si ya existe el producto en el carrito
  const existingItem = carrito.find((item) => item.producto.id === producto.id);
  const precioBaseNum = parseFloat(producto.precio.toString());

  if (existingItem) {
    existingItem.cantidad += 1;
    
    const modificadoresExtra = (existingItem.modificadores || []).reduce(
      (sum, mod) => sum + parseFloat(mod.precio_extra.toString()),
      0
    );
    existingItem.subtotal = existingItem.cantidad * (existingItem.precio_unitario + modificadoresExtra);
    
    this.carrito.set([...carrito]);
  } else {
      const modificadoresPredeterminados: CartItemModificador[] = [];
      const grupos = producto.modificadores || [];

      grupos.forEach(grupo => {
        grupo.opciones?.forEach(opcion => {
          if (opcion.predeterminado) {
            modificadoresPredeterminados.push({
              modificador_id: grupo.id,
              opcion_id: opcion.id,
              opcion_nombre: opcion.nombre,
              // CORRECCIÓN: Forzar número real aquí
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
      item.cantidad = data.cantidad;
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

  onOrderTypeChanged(tipoOrden: 'dine-in' | 'to-go' | 'delivery'): void {
    this.orderType.set(tipoOrden);
  }

  onCheckoutRequested(): void {
    this.isCheckoutModalOpen.set(true);
  }

  onPayLaterRequested(): void {
    this.isProcessingCheckout.set(true);
    const order: Order = {
      id: this.editingOrderId() || 0,
      items: this.carrito(),
      subtotal: this.subtotal(),
      total: this.total(),
      metodo_pago: 'efectivo',
      estado: 'adeudado',
      cliente_id: this.selectedCliente()?.id,
      tipo_orden: this.orderType(),
      mesa_id: this.selectedMesa()?.id,
    };

    if (this.isEditingOrder() && this.editingOrderId()) {
      // Modo edición: Eliminar orden antigua y crear la nueva
      const orderId = this.editingOrderId()!;
      this.posService.eliminarOrden(orderId).subscribe({
        next: () => {
          this.posService.crearOrden(order).subscribe({
            next: (response) => {
              this.finalizarVenta();
              this.isProcessingCheckout.set(false);
              this.isEditingOrder.set(false);
              this.editingOrderId.set(null);
              this.mostrarExito('Orden adeudada actualizada exitosamente');
            },
            error: (err) => {
              this.error.set('Error al procesar la orden adeudada');
              this.isProcessingCheckout.set(false);
            },
          });
        },
        error: () => {
          this.error.set('Error al actualizar la orden');
          this.isProcessingCheckout.set(false);
        }
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
    this.carrito.set([]);
    this.selectedCliente.set(null);
    this.selectedMesa.set(null);
  }

  onCheckoutConfirmed(data: {
    metodoPago: PaymentMethodType;
    clienteId?: number;
    mesaId?: number;
  }): void {
    this.isProcessingCheckout.set(true);

    const order: Order = {
      id: this.editingOrderId() || 0,
      items: this.carrito(),
      subtotal: this.subtotal(),
      total: this.total(),
      metodo_pago: data.metodoPago,
      cliente_id: data.clienteId,
      tipo_orden: this.orderType(),
      mesa_id: data.mesaId,
    };

    if (this.isEditingOrder() && this.editingOrderId()) {
      // Modo edición: Eliminar orden antigua y crear una nueva con los cambios
      const orderId = this.editingOrderId()!;
      this.posService.eliminarOrden(orderId).subscribe({
        next: () => {
          // Después de eliminar, crear la nueva orden
          this.posService.crearOrden(order).subscribe({
            next: (response) => {
              this.finalizarVenta();
              this.isCheckoutModalOpen.set(false);
              this.isProcessingCheckout.set(false);
              this.isEditingOrder.set(false);
              this.editingOrderId.set(null);
              this.mostrarExito('Orden actualizada y pagada exitosamente');
            },
            error: (err) => {
              this.error.set('Error al crear la nueva orden');
              this.isProcessingCheckout.set(false);
            },
          });
        },
        error: () => {
          this.error.set('Error al actualizar la orden');
          this.isProcessingCheckout.set(false);
        }
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

  private finalizarVenta(): void {
    console.log('Venta finalizada, limpiando estado...');
    this.carrito.set([]);
    this.selectedCategoryId.set(null);
    this.selectedSubcategoryId.set(null);
    this.selectedCliente.set(null);
    this.selectedMesa.set(null);
    this.isEditingOrder.set(false);
    this.editingOrderId.set(null);
    this.cargarProductos();
  }

  private mostrarExito(mensaje: string): void {
    this.toastr.success(mensaje, 'Éxito');
  }

  // ==================== HELPERS ====================
  trackByCategoria = (index: number, cat: Categoria) => cat.id;
}
