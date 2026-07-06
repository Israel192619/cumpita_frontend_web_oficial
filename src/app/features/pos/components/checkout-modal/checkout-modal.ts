import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CartItem } from '@app/features/pos/services/pos-service';

export type PaymentMethodType = 'efectivo' | 'qr' | 'tarjeta';

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
  }>();
  checkoutCancelled = output<void>();

  form: FormGroup;
  paymentMethods: Array<{ id: PaymentMethodType; nombre: string; icon: string }> = [
    { id: 'efectivo', nombre: 'Efectivo', icon: '💵' },
    { id: 'qr', nombre: 'Código QR', icon: '📱' },
    { id: 'tarjeta', nombre: 'Tarjeta', icon: '💳' },
  ];

  selectedPaymentMethod = signal<PaymentMethodType | null>(null);
  showClientForm = signal<boolean>(false);
  showClientSearch = signal<boolean>(false);
  showCreateClient = signal<boolean>(false);
  
  // Inputs for client/mesa now come from the cart panel
  clienteId = input<number | null>(null);
  mesaId = input<number | null>(null);

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

  onConfirm(): void {
    if (!this.selectedPaymentMethod()) {
      return;
    }

    this.checkoutConfirmed.emit({
      metodoPago: this.selectedPaymentMethod()!,
      clienteId: this.clienteId?.() || undefined,
      mesaId: this.mesaId?.() || undefined,
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
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price);
  }

  trackByItem = (index: number, item: CartItem) => item.id;
  
}
