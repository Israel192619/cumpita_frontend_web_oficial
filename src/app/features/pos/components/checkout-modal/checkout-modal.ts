import { Component, input, output, signal, computed, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CartItem, PagoOrden } from '@app/features/pos/services/pos-service';

export type PaymentMethodType = 'efectivo' | 'qr';
export type PaymentStatus = 'insufficient' | 'exact' | 'excess';

@Component({
  selector: 'app-checkout-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './checkout-modal.html',
  styleUrl: './checkout-modal.css',
})
export class CheckoutModalComponent implements OnChanges {
  items = input<CartItem[]>([]);
  total = input<number>(0);
  remainingAmount = input<number>(0);
  refundAmount = input<number>(0);
  paymentHistory = input<PagoOrden[]>([]);
  isOpen = input<boolean>(false);
  isProcessing = input<boolean>(false);
  orderType = input<'dine-in' | 'to-go' | 'delivery'>('dine-in');
  isRefundMode = input<boolean>(false);
  deletedItems = input<CartItem[]>([]);

  checkoutConfirmed = output<{
    metodoPago: PaymentMethodType;
    clienteNombre?: string;
    clienteTelefono?: string;
    clienteId?: number;
    mesaId?: number;
    montoRecibido?: number;
    tipoPago?: 'pago' | 'devolucion';
  }>();
  checkoutCancelled = output<void>();

  form: FormGroup;
  paymentMethods: Array<{ id: PaymentMethodType; nombre: string; icon: string }> = [
    { id: 'efectivo', nombre: 'Efectivo', icon: '💵' },
    { id: 'qr', nombre: 'Pago QR', icon: '📱' },
  ];
  quickAmounts = [20, 50, 100, 200];

  selectedPaymentMethod = signal<PaymentMethodType | null>(null);
  showClientForm = signal<boolean>(false);
  showClientSearch = signal<boolean>(false);
  showCreateClient = signal<boolean>(false);

  clienteId = input<number | null>(null);
  mesaId = input<number | null>(null);

  montoRecibido = signal<number>(0);

  cambio = computed(() => {
    const monto = this.montoRecibido();
    const totalAPagar = this.getTargetAmount();
    return Math.max(0, this.roundCurrency(monto - totalAPagar));
  });

  estadoPago = computed<PaymentStatus>(() => {
    const monto = this.montoRecibido();
    const totalAPagar = this.getTargetAmount();
    const diff = this.roundCurrency(monto - totalAPagar);

    if (diff < 0) {
      return 'insufficient';
    } else if (diff === 0) {
      return 'exact';
    }

    return 'excess';
  });

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      metodoPago: [null, Validators.required],
      mesaNumero: [''],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // When modal is opened or when relevant amounts change while open, set default received amount
    if (changes['isOpen'] && this.isOpen()) {
      this.selectedPaymentMethod.set(null);
      this.form.patchValue({ metodoPago: null });
      const initialAmount = this.getTargetAmount();
      this.montoRecibido.set(initialAmount);
      return;
    }

    if (this.isOpen() && (changes['remainingAmount'] || changes['refundAmount'] || changes['total'])) {
      const initialAmount = this.getTargetAmount();
      this.montoRecibido.set(initialAmount);
    }
  }

  onSelectPaymentMethod(method: PaymentMethodType): void {
    this.selectedPaymentMethod.set(method);
    this.form.patchValue({ metodoPago: method });

    if (this.montoRecibido() === 0) {
      this.montoRecibido.set(this.getTargetAmount());
    }
  }

  onMontoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    const monto = value ? parseFloat(value) : 0;
    this.montoRecibido.set(Math.max(0, monto));
  }

  selectQuickAmount(amount: number): void {
    this.montoRecibido.set(amount);
  }

  selectExactAmount(): void {
    this.montoRecibido.set(this.getTargetAmount());
  }

  onConfirm(): void {
    if (!this.selectedPaymentMethod()) {
      return;
    }

    const metodoPago = this.selectedPaymentMethod();
    if (!metodoPago) {
      return;
    }

    this.checkoutConfirmed.emit({
      metodoPago,
      clienteId: this.clienteId?.() || undefined,
      mesaId: this.mesaId?.() || undefined,
      montoRecibido: this.montoRecibido(),
      tipoPago: this.isRefundMode() ? 'devolucion' : undefined,
    });
  }

  onCancel(): void {
    this.checkoutCancelled.emit();
    this.resetForm();
  }

  private resetForm(): void {
    this.form.reset({ metodoPago: null });
    this.selectedPaymentMethod.set(null);
    this.showClientForm.set(false);
    this.showClientSearch.set(false);
    this.showCreateClient.set(false);
    this.montoRecibido.set(0);
  }

  private roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  }

  getTargetAmount(): number {
    if (this.isRefundMode()) {
      return this.roundCurrency(this.refundAmount());
    }

    // If there is a remaining amount, prefer that.
    if (this.remainingAmount() > 0) {
      return this.roundCurrency(this.remainingAmount());
    }

    // If order has payment history and remaining is zero, target should be 0 (already paid).
    const payments = this.paymentHistory() || [];
    if (payments.length > 0 && this.remainingAmount() === 0) {
      return 0;
    }

    // Fallback to total when there's no payment history (new order)
    return this.roundCurrency(this.total());
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
    const diferencia = Math.abs(this.montoRecibido() - this.getTargetAmount());

    if (this.isRefundMode()) {
      switch (estado) {
        case 'insufficient':
          return 'Falta por devolver';
        case 'exact':
          return 'Devolución completa';
        case 'excess':
          return 'Cambio por parte del cliente';
        default:
          return '';
      }
    }

    switch (estado) {
      case 'insufficient':
        return 'Falta por cobrar';
      case 'exact':
        return 'Pago completo';
      case 'excess':
        return 'Cambio';
      default:
        return '';
    }
  }

  getConfirmButtonLabel(): string {
    if (this.isProcessing()) {
      return 'Procesando...';
    }

    if (!this.selectedPaymentMethod()) {
      return 'Seleccionar método';
    }

    const targetAmount = this.getTargetAmount();
    const remainingToPay = this.roundCurrency(Math.max(0, targetAmount - this.montoRecibido()));

    if (this.isRefundMode()) {
      if (this.estadoPago() === 'insufficient') {
        return `Falta devolver ${remainingToPay.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} COP`;
      }
      return this.estadoPago() === 'excess'
        ? `Completar pago y devolver ${this.cambio().toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} COP`
        : 'Registrar devolución';
    }

    if (this.estadoPago() === 'insufficient') {
      return `Continuar con la deuda de ${remainingToPay.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} COP`;
    }

    if (this.estadoPago() === 'excess') {
      return `Completar pago y devolver ${this.cambio().toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} COP`;
    }

    return 'Completar pago';
  }

  getConfirmButtonClass(): string {
    if (this.isRefundMode() && this.estadoPago() === 'excess') {
      return 'btn-confirm btn-confirm-change';
    }

    if (!this.isRefundMode() && this.estadoPago() === 'insufficient') {
      return 'btn-confirm btn-confirm-debt';
    }

    return 'btn-confirm';
  }

  getRecentPayments(): PagoOrden[] {
    return (this.paymentHistory() || []).slice(0, 3);
  }

  trackByItem = (index: number, item: CartItem) => item.id;
}
