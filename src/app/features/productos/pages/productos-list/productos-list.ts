import { Component, OnDestroy, signal } from '@angular/core';
import { Producto } from '../../../../core/models/producto';
import { ProductoService } from '../../services/producto-service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { timeout } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog-service';
import { DataTable, Modal } from '../../../../shared/components';
import { AppCurrencyPipe } from '../../../../shared/pipes/app-currency.pipe';
import { ReverbService } from '../../../../core/services/reverb-service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-productos-list',
  imports: [CommonModule, DataTable, Modal, AppCurrencyPipe],
  templateUrl: './productos-list.html',
  styleUrl: './productos-list.css',
})
export class ProductosList implements OnDestroy {
  productos = signal<Producto[]>([]);
  isloading = signal(false);
  error = signal<string | null>(null);
  selectedProduct = signal<Producto | null>(null);
  isLoadingDetail = signal(false);
  private stockSubscription?: Subscription;
  private reservationSubscription?: Subscription;

  constructor(
    private productoService: ProductoService,
    private router: Router,
    private toastr: ToastrService,
    private confirmDialog: ConfirmDialogService,
    private reverb: ReverbService
  ) {}

  ngOnInit(): void {
    this.obtenerProductos();
    this.stockSubscription = this.reverb
      .escucharCanal('canal-inventario', '.StockActualizado')
      .subscribe((event: { producto_id?: number | null; modificador_opcion_id?: number | null; stock?: number }) => {
        if (event.stock == null) return;
        this.productos.update(products => products.map(product => this.withUpdatedStock(product, event)));
        this.selectedProduct.update(product => product ? this.withUpdatedStock(product, event) : null);
      });
    this.reservationSubscription = this.reverb
      .escucharCanal('canal-inventario', '.ReservaStockActualizada')
      .subscribe(() => {
        this.obtenerProductos();
        const selectedId = this.selectedProduct()?.id;
        if (selectedId) this.productoService.obtenerProducto(selectedId).subscribe(product => this.selectedProduct.set(product));
      });
  }

  ngOnDestroy(): void {
    this.stockSubscription?.unsubscribe();
    this.reservationSubscription?.unsubscribe();
  }

  obtenerProductos(categoriaId?: number): void {
    this.isloading.set(true);
    this.error.set(null);

    this.productoService
      .listarProductos(categoriaId)
      .pipe(timeout(10000))
      .subscribe({
        next: (data) => {
          this.productos.set(data.map(product => this.withInventoryLabel(product)));
          this.isloading.set(false);
        },
        error: () => {
          this.isloading.set(false);
          this.error.set('Error al cargar productos');
        }
      });
  }

  handleAction(event: { type: string, item: Producto }): void {
    const { type, item } = event;

    if (type === 'edit') {
      this.router.navigate(['/app/productos/edit', item.id]);
    }

    if (type === 'view') this.verProducto(item.id);

    if (type === 'delete') {
      this.eliminarProducto(item.id);
    }
  }

  eliminarProducto(id: number) {
    this.confirmDialog.confirm({
      title: 'Eliminar producto',
      message: '¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.'
    }).subscribe(result => {
      if (result) {
        this.productoService.eliminarProducto(id).subscribe({
          next: () => {
            this.productos.update(prods => prods.filter(p => p.id !== id));
            this.toastr.success('Producto eliminado correctamente');
          }
        });
      }
    });
  }

  crearProducto() {
    this.router.navigate(['/app/productos/create']);
  }

  recargar() {
    this.obtenerProductos();
  }

  verProducto(id: number): void {
    this.isLoadingDetail.set(true);
    this.productoService.obtenerProducto(id).subscribe({
      next: product => { this.selectedProduct.set(product); this.isLoadingDetail.set(false); },
      error: error => {
        this.isLoadingDetail.set(false);
        this.toastr.error(error?.error?.message || 'No se pudo cargar el detalle del producto.');
      },
    });
  }

  cerrarDetalle(): void { this.selectedProduct.set(null); }

  stockOptions(product: Producto): number {
    return (product.modificadores || []).reduce(
      (total, group) => total + (group.opciones || []).filter(option => option.maneja_stock).length,
      0,
    );
  }

  private withUpdatedStock(
    product: Producto,
    event: { producto_id?: number | null; modificador_opcion_id?: number | null; stock?: number },
  ): Producto {
    if (event.producto_id === product.id) {
      return this.withInventoryLabel({ ...product, stock: event.stock, stock_disponible: event.stock });
    }
    if (event.modificador_opcion_id == null) return product;
    let changed = false;
    const modificadores = (product.modificadores || []).map(group => ({
      ...group,
      opciones: (group.opciones || []).map(option => {
        if (option.id !== event.modificador_opcion_id) return option;
        changed = true;
        return { ...option, stock: event.stock, stock_disponible: event.stock };
      }),
    }));
    return changed ? this.withInventoryLabel({ ...product, modificadores }) : product;
  }

  private withInventoryLabel(product: Producto): Producto {
    const options = (product.modificadores || [])
      .flatMap(group => group.opciones || [])
      .filter(option => option.maneja_stock);
    const inventarioActual = product.maneja_stock
      ? `${product.stock_disponible ?? product.stock ?? 0} unidades`
      : options.length
        ? `${options.length} opciones con stock`
        : 'Sin control';
    return Object.assign(product, { inventario_actual: inventarioActual });
  }
}

