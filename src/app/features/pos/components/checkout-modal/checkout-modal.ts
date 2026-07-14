import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CartItem } from '@app/features/pos/services/pos-service';

export type PaymentMethodType = 'efectivo' | 'qr' | 'tarjeta';
export type PaymentStatus = 'insufficient' | 'exact' | 'excess';

@Component({
  selector: 'app-checkout-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './checkout-modal.html',
  styleUrl: './checkout-modal.css',
})
export class CheckoutModalComponent {
  items = input<CartItem[]>([]);
  total = input<number>(0);
  isOpen = input<boolean>(false);
  isProcessing = input<boolean>(false);
  orderType = input<'dine-in' | 'to-go' | 'delivery'>('dine-in');

  checkoutConfirmed = output<{
    metodoPago: PaymentMethodType;
    clienteNombre?: string;
    clienteTelefono?: string;
    clienteId?: number;
    mesaId?: number;
    montoRecibido?: number;
  }>();
  checkoutCancelled = output<void>();

  form: FormGroup;
  paymentMethods: Array<{ id: PaymentMethodType; nombre: string; icon: string }> = [
    { id: 'efectivo', nombre: 'Efectivo', icon: '💵' },
    { id: 'qr', nombre: 'Código QR', icon: '📱' },
    { id: 'tarjeta', nombre: 'Tarjeta', icon: '💳' },
  ];

  selectedPaymentMethod = signal<PaymentMethodType | null>('efectivo');
  showClientForm = signal<boolean>(false);
  showClientSearch = signal<boolean>(false);
  showCreateClient = signal<boolean>(false);
  
  // Inputs for client/mesa now come from the cart panel
  clienteId = input<number | null>(null);
  mesaId = input<number | null>(null);

  // Monto de pago
  montoRecibido = signal<number>(0);
  
  // Computed: cambio
  cambio = computed(() => {
    const monto = this.montoRecibido();
    const totalAPagar = this.total();
    return Math.max(0, monto - totalAPagar);
  });

  // Computed: estado del pago
  estadoPago = computed<PaymentStatus>(() => {
    const monto = this.montoRecibido();
    const totalAPagar = this.total();
    
    if (monto < totalAPagar) {
      return 'insufficient';
    } else if (monto === totalAPagar) {
      return 'exact';
    } else {
      return 'excess';
    }
  });

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      metodoPago: ['efectivo', Validators.required],
      mesaNumero: [''],
    });
  }

  onSelectPaymentMethod(method: PaymentMethodType): void {
    this.selectedPaymentMethod.set(method);
    this.form.patchValue({ metodoPago: method });
  }

  onMontoChange(event: any): void {
    const value = event.target.value;
    const monto = value ? parseFloat(value) : 0;
    this.montoRecibido.set(Math.max(0, monto));
  }

  onConfirm(): void {
    if (!this.selectedPaymentMethod()) {
      return;
    }

    // Para tarjeta y QR, usar el total exacto
    const montoFinal = this.selectedPaymentMethod() === 'efectivo' 
      ? this.montoRecibido() 
      : this.total();

    if (montoFinal < this.total()) {
      // No permitir pago insuficiente en tarjeta/QR
      if (this.selectedPaymentMethod() !== 'efectivo') {
        return;
      }
    }

    this.checkoutConfirmed.emit({
      metodoPago: this.selectedPaymentMethod()!,
      clienteId: this.clienteId?.() || undefined,
      mesaId: this.mesaId?.() || undefined,
      montoRecibido: this.selectedPaymentMethod() === 'efectivo' ? this.montoRecibido() : undefined,
    });
  }

  onCancel(): void {
    this.checkoutCancelled.emit();
    this.resetForm();
  }

  private resetForm(): void {
    this.form.reset({ metodoPago: 'efectivo' });
    this.selectedPaymentMethod.set(null);
    this.showClientForm.set(false);
    this.showClientSearch.set(false);
    this.showCreateClient.set(false);
    this.montoRecibido.set(0);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price);
  }

  getPaymentStatusClass(): string {
    const estado = this.estadoPago();
    switch (estado) {
      case 'insufficient':
        return 'status-insufficient';
      case 'exact':
        return 'status-exact';
      case 'excess':
        return 'status-excess';
      default:
        return '';
    }
  }

  getPaymentStatusText(): string {
    const estado = this.estadoPago();
    const diferencia = Math.abs(this.montoRecibido() - this.total());
    
    switch (estado) {
      case 'insufficient':
        return `Faltan ${this.formatPrice(diferencia)}`;
      case 'exact':
        return 'Monto exacto';
      case 'excess':
        return `Cambio: ${this.formatPrice(diferencia)}`;
      default:
        return '';
    }
  }

  trackByItem = (index: number, item: CartItem) => item.id;
  
}
