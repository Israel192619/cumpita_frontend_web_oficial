import { availableProductUnits } from './product-availability';
import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Producto } from '@app/core/models/producto';
import { ProductoService } from '@app/features/productos/services/producto-service';
import { ToastrService } from 'ngx-toastr';
import { formatCurrency } from '@app/core/config/currency.config';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-product-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-grid.html',
  styleUrls: ['./product-grid.css', './product-grid-restock.css', './product-grid-restock-options.css'],
})
export class ProductGridComponent {
  productos = input<Producto[]>([]);
  isLoading = input<boolean>(false);
  compact = input<boolean>(false);
  allowStockAdjustment = input<boolean>(true);
  showPrices = input<boolean>(true);
  modifierUsageByOption = input<Record<number, number>>({});
  cartQuantityByProduct = input<Record<number, number>>({});

  productAdded = output<Producto>();
  stockAdjusted = output<void>();

  restockingProductId = signal<number | null>(null);
  restockProduct = signal<Producto | null>(null);
  restockQuantity = signal('1');
  restockOptionId = signal<number | null>(null);

  constructor(
    private productoService: ProductoService,
    private toastr: ToastrService,
  ) {}

  onAddProduct(producto: Producto): void {
    if (this.isProductAvailable(producto)) {
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
    const available = this.getAvailableUnits(producto);
    return producto.activo && (available === null || available > 0);
  }

  isOutOfStock(producto: Producto): boolean {
    return this.getAvailableUnits(producto) === 0;
  }

  getStockState(producto: Producto): 'warning' | 'empty' | 'ok' | 'none' {
    const stock = this.getAvailableUnits(producto);
    if (stock === null) return 'none';
    const minimo = producto.maneja_stock ? producto.stock_minimo || 0 : 1;

    if (stock <= 0) {
      return 'empty';
    }

    if (minimo > 0 && stock <= minimo) {
      return 'warning';
    }

    return 'ok';
  }

  getAvailableUnits(producto: Producto): number | null {
    return availableProductUnits(producto, this.modifierUsageByOption());
  }

  openRestockDialog(producto: Producto): void {
    if (this.restockingProductId() !== null) return;
    this.restockProduct.set(producto);
    this.restockQuantity.set('1');
    this.restockOptionId.set(producto.maneja_stock ? null : this.stockOptions(producto)[0]?.id ?? null);
  }

  closeRestockDialog(): void {
    if (this.restockingProductId() === null) this.restockProduct.set(null);
  }

  setRestockQuantity(value: string): void {
    this.restockQuantity.set(value.replace(/\D/g, '') || '1');
  }

  setRestockOption(value: string): void { this.restockOptionId.set(Number(value) || null); }

  stockOptions(producto: Producto) {
    return (producto.modificadores || []).flatMap(group => group.opciones || [])
      .filter(option => option.activo !== false && option.maneja_stock);
  }

  confirmRestock(): void {
    const producto = this.restockProduct();
    const quantity = Number.parseInt(this.restockQuantity(), 10);
    if (!producto || !Number.isFinite(quantity) || quantity < 1) {
      this.toastr.warning('Ingresa una cantidad válida para reabastecer.');
      return;
    }

    const optionId = this.restockOptionId();
    if (!producto.maneja_stock && !optionId) {
      this.toastr.warning('Selecciona la presa u opción que deseas reabastecer.');
      return;
    }
    this.restockingProductId.set(producto.id);
    const request: Observable<unknown> = producto.maneja_stock
      ? this.productoService.ajustarStock(producto.id, quantity)
      : this.productoService.crearAjusteStock({ modificador_opcion_id: optionId!, tipo: 'ENTRADA', cantidad: quantity, motivo: `Reabastecimiento desde POS: ${producto.nombre}` });
    request.subscribe({
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
