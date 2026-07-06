import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Producto } from '@app/core/models/producto';

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

  productAdded = output<Producto>();

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

  trackByProducto = (index: number, prod: Producto) => prod.id;
}
