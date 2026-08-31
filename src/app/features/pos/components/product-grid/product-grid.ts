import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Producto } from '@app/core/models/producto';
import { ProductoService } from '@app/features/productos/services/producto-service';
import { ToastrService } from 'ngx-toastr';
import { formatCurrency } from '@app/core/config/currency.config';

@Component({
  selector: 'app-product-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-grid.html',
  styleUrls: ['./product-grid.css', './product-grid-restock.css'],
})
export class ProductGridComponent {
  productos = input<Producto[]>([]);
  isLoading = input<boolean>(false);
  compact = input<boolean>(false);
  allowStockAdjustment = input<boolean>(true);
  showPrices = input<boolean>(true);

  productAdded = output<Producto>();
  stockAdjusted = output<void>();

  restockingProductId = signal<number | null>(null);
  restockProduct = signal<Producto | null>(null);
  restockQuantity = signal('1');

  constructor(
    private productoService: ProductoService,
    private toastr: ToastrService,
  ) {}

  onAddProduct(producto: Producto): void {
    if (producto.activo && (!producto.maneja_stock || (producto.stock || 0) > 0)) {
      this.productAdded.emit(producto);
    }
  }

  getProductImage(producto: Producto): string {
    return producto.imagen_url || '/images/no-image.png';
  }

  formatPrice(price: number): string {
    return formatCurrency(price);
  }

  isProductAvailable(producto: Producto): boolean {
    return producto.activo && (!producto.maneja_stock || (producto.stock || 0) > 0);
  }

  isOutOfStock(producto: Producto): boolean {
    return !!producto.maneja_stock && (producto.stock || 0) <= 0;
  }

  getStockState(producto: Producto): 'warning' | 'empty' | 'ok' | 'none' {
    if (!producto.maneja_stock) {
      return 'none';
    }

    const stock = producto.stock || 0;
    const minimo = producto.stock_minimo || 0;

    if (stock <= 0) {
      return 'empty';
    }

    if (minimo > 0 && stock <= minimo) {
      return 'warning';
    }

    return 'ok';
  }

  openRestockDialog(producto: Producto): void {
    if (this.restockingProductId() !== null) return;
    this.restockProduct.set(producto);
    this.restockQuantity.set('1');
  }

  closeRestockDialog(): void {
    if (this.restockingProductId() === null) this.restockProduct.set(null);
  }

  setRestockQuantity(value: string): void {
    this.restockQuantity.set(value.replace(/\D/g, '') || '1');
  }

  confirmRestock(): void {
    const producto = this.restockProduct();
    const quantity = Number.parseInt(this.restockQuantity(), 10);
    if (!producto || !Number.isFinite(quantity) || quantity < 1) {
      this.toastr.warning('Ingresa una cantidad válida para reabastecer.');
      return;
    }

    this.restockingProductId.set(producto.id);
    this.productoService.ajustarStock(producto.id, quantity).subscribe({
      next: () => {
        this.restockingProductId.set(null);
        this.restockProduct.set(null);
        this.toastr.success(`Se reabastecieron ${quantity} ${quantity === 1 ? 'unidad' : 'unidades'} de ${producto.nombre}`);
        this.stockAdjusted.emit();
      },
      error: error => {
        this.restockingProductId.set(null);
        this.toastr.error(error?.error?.message || 'No se pudo reabastecer el producto');
      }
    });
  }

  trackByProducto = (index: number, prod: Producto) => prod.id;
}
