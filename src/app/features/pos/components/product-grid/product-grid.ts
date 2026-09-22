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
  restockOptionQuantities = signal<Record<number, string>>({});
  pendingRestockOptions = signal<Record<number, number>>({});

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
    const quantities = Object.fromEntries(this.stockOptions(producto).map(option => [option.id, '1']));
    this.restockOptionQuantities.set(quantities);
    this.pendingRestockOptions.set({});
  }

  closeRestockDialog(): void {
    if (this.restockingProductId() === null) this.restockProduct.set(null);
  }

  setRestockQuantity(value: string): void {
    this.restockQuantity.set(value.replace(/\D/g, '') || '1');
  }

  setRestockOptionQuantity(optionId: number, value: string): void {
    const sanitized = value.replace(/\D/g, '');
    this.restockOptionQuantities.update(quantities => ({ ...quantities, [optionId]: sanitized }));
  }

  addRestockOption(optionId: number): void {
    const quantity = Number.parseInt(this.restockOptionQuantities()[optionId] || '', 10);
    if (!Number.isFinite(quantity) || quantity < 1) {
      this.toastr.warning('Ingresa una cantidad válida para agregar.');
      return;
    }
    this.pendingRestockOptions.update(pending => ({ ...pending, [optionId]: (pending[optionId] || 0) + quantity }));
    this.restockOptionQuantities.update(quantities => ({ ...quantities, [optionId]: '1' }));
  }

  removePendingRestockOption(optionId: number): void {
    this.pendingRestockOptions.update(pending => {
      const updated = { ...pending };
      delete updated[optionId];
      return updated;
    });
  }

  pendingRestockTotal(): number {
    return Object.values(this.pendingRestockOptions()).reduce((total, quantity) => total + quantity, 0);
  }

  stockOptions(producto: Producto) {
    return (producto.modificadores || []).flatMap(group => group.opciones || [])
      .filter(option => option.activo !== false && option.maneja_stock);
  }

  confirmRestock(): void {
    const producto = this.restockProduct();
    const quantity = Number.parseInt(this.restockQuantity(), 10);
    if (!producto) return;

    if (producto.maneja_stock && (!Number.isFinite(quantity) || quantity < 1)) {
      this.toastr.warning('Ingresa una cantidad válida para reabastecer.');
      return;
    }

    const optionItems = Object.entries(this.pendingRestockOptions())
      .map(([optionId, itemQuantity]) => ({ modificador_opcion_id: Number(optionId), cantidad: itemQuantity }))
      .filter(item => item.cantidad > 0);
    if (!producto.maneja_stock && optionItems.length === 0) {
      this.toastr.warning('Agrega al menos una presa u opción antes de aceptar.');
      return;
    }
    this.restockingProductId.set(producto.id);
    const request: Observable<unknown> = producto.maneja_stock
      ? this.productoService.ajustarStock(producto.id, quantity)
      : this.productoService.crearAjustesStockLote(producto.id, optionItems, `Reabastecimiento desde POS: ${producto.nombre}`);
    request.subscribe({
      next: () => {
        this.restockingProductId.set(null);
        this.restockProduct.set(null);
        const total = producto.maneja_stock ? quantity : this.pendingRestockTotal();
        this.toastr.success(`Se reabastecieron ${total} ${total === 1 ? 'unidad' : 'unidades'} de ${producto.nombre}`);
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
