import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Producto } from '@app/core/models/producto';
import { ProductoService } from '@app/features/productos/services/producto-service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-product-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-grid.html',
  styleUrl: './product-grid.css',
})
export class ProductGridComponent {
  productos = input<Producto[]>([]);
  isLoading = input<boolean>(false);
  compact = input<boolean>(false);

  productAdded = output<Producto>();
  stockAdjusted = output<void>();

  restockQuantities = signal<Record<number, string>>({});

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
  // Aseguramos que el valor sea un número limpio
  const cleanPrice = typeof price === 'string' ? parseFloat(price) : price;

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0, // Si es entero, no muestra decimales (ej: $ 5)
    maximumFractionDigits: 2, // Si tiene decimales, muestra hasta dos (ej: $ 5,59)
  }).format(cleanPrice);
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

  getRestockQuantity(producto: Producto): string {
    return this.restockQuantities()[producto.id] ?? '10';
  }

  setRestockQuantity(producto: Producto, value: string): void {
    const nextValue = value.replace(/\D/g, '');
    this.restockQuantities.set({
      ...this.restockQuantities(),
      [producto.id]: nextValue || '1'
    });
  }

  onRestockProduct(producto: Producto): void {
    const quantity = Number.parseInt(this.getRestockQuantity(producto), 10);
    const amount = Number.isFinite(quantity) && quantity > 0 ? quantity : 10;

    this.productoService.ajustarStock(producto.id, amount).subscribe({
      next: () => {
        this.toastr.success(`Se reabastecieron ${amount} unidades de ${producto.nombre}`);
        this.stockAdjusted.emit();
      },
      error: () => this.toastr.error('No se pudo reabastecer el producto')
    });
  }

  trackByProducto = (index: number, prod: Producto) => prod.id;
}
