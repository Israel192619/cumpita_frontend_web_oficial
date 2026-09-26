import { Component, input, output, signal, computed, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CancelacionInfo, CartItem, PagoOrden } from '@app/features/pos/services/pos-service';
import { Button } from '@app/shared/components/button/button';
import { Icon, IconName } from '@app/shared/components/icon/icon';
import { Modal } from '@app/shared/components/modal/modal';
import { CURRENCY_CONFIG, formatCurrency } from '@app/core/config/currency.config';

export type PaymentMethodType = 'efectivo' | 'qr';
export type PaymentStatus = 'insufficient' | 'exact' | 'excess';
export interface SplitPaymentInput {
  metodoPago: PaymentMethodType;
  montoAplicado: number;
  montoRecibido: number;
}
interface SplitPaymentLine extends SplitPaymentInput { id: number; }

@Component({
  selector: 'app-checkout-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Modal, Button, Icon],
  templateUrl: './checkout-modal.html',
  styleUrl: './checkout-modal.css',
})
export class CheckoutModalComponent implements OnChanges {
  readonly currencySymbol = CURRENCY_CONFIG.symbol;
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
  cancelacionInfo = input<CancelacionInfo | null>(null);

  checkoutConfirmed = output<{
    metodoPago: PaymentMethodType;
    clienteNombre?: string;
    clienteTelefono?: string;
    clienteId?: number;
    mesaId?: number;
    montoRecibido?: number;
    tipoPago?: 'pago' | 'devolucion';
    pagosDivididos?: SplitPaymentInput[];
  }>();
  checkoutCancelled = output<void>();

  form: FormGroup;
  paymentMethods: Array<{ id: PaymentMethodType; nombre: string; icon: IconName }> = [
    { id: 'efectivo', nombre: 'Efectivo', icon: 'banknote' },
    { id: 'qr', nombre: 'Pago QR', icon: 'qrcode' },
  ];
  quickAmounts = [20, 50, 100, 200];

  selectedPaymentMethod = signal<PaymentMethodType | null>(null);
  showClientForm = signal<boolean>(false);
  showClientSearch = signal<boolean>(false);
  showCreateClient = signal<boolean>(false);

  // Exponer Math para usarlo en el template
  Math = Math;

  clienteId = input<number | null>(null);
  mesaId = input<number | null>(null);

  montoRecibido = signal<number>(0);
  modoPagoDividido = signal(false);
  pagosDivididos = signal<SplitPaymentLine[]>([]);
  private siguientePagoId = 1;

  totalDividido = computed(() => this.roundCurrency(
    this.pagosDivididos().reduce((total, pago) => total + Number(pago.montoAplicado || 0), 0)
  ));
  saldoDividido = computed(() => this.roundCurrency(this.getTargetAmount() - this.totalDividido()));
  pagoDivididoValido = computed(() => this.pagosDivididos().length >= 2
    && this.pagosDivididos().every(pago => pago.montoAplicado > 0
      && (pago.metodoPago !== 'efectivo' || pago.montoRecibido >= pago.montoAplicado))
    && this.totalDividido() > 0
    && this.totalDividido() <= this.getTargetAmount());

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
      this.modoPagoDividido.set(false);
      this.pagosDivididos.set([]);
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
    if (method === 'efectivo' && this.efectivoInsuficiente()) return;
    this.selectedPaymentMethod.set(method);
    this.form.patchValue({ metodoPago: method });

    if (this.montoRecibido() === 0) {
      this.montoRecibido.set(this.getTargetAmount());
    }
  }

  efectivoInsuficiente(): boolean {
    return this.isRefundMode() && Number(this.cancelacionInfo()?.faltante_efectivo || 0) > 0;
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
    if (this.modoPagoDividido()) {
      if (!this.pagoDivididoValido()) return;
      const pagos = this.pagosDivididos().map(({ metodoPago, montoAplicado, montoRecibido }) => ({
        metodoPago,
        montoAplicado: this.roundCurrency(montoAplicado),
        montoRecibido: this.roundCurrency(metodoPago === 'qr' ? montoAplicado : montoRecibido),
      }));
      this.checkoutConfirmed.emit({
        metodoPago: pagos[0].metodoPago,
        clienteId: this.clienteId?.() || undefined,
        mesaId: this.mesaId?.() || undefined,
        montoRecibido: this.roundCurrency(pagos.reduce((total, pago) => total + pago.montoRecibido, 0)),
        pagosDivididos: pagos,
      });
      return;
    }
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
    this.modoPagoDividido.set(false);
    this.pagosDivididos.set([]);
  }

  activarPagoDividido(dividido: boolean): void {
    if (this.isRefundMode()) return;
    this.modoPagoDividido.set(dividido);
    if (dividido && this.pagosDivididos().length === 0) {
      this.pagosDivididos.set([
        this.nuevaParte('qr'),
        this.nuevaParte('efectivo'),
      ]);
    }
  }

  agregarParte(): void {
    if (this.pagosDivididos().length >= 6) return;
    const ultimo = this.pagosDivididos().at(-1)?.metodoPago;
    this.pagosDivididos.update(pagos => [...pagos, this.nuevaParte(ultimo === 'qr' ? 'efectivo' : 'qr')]);
  }

  quitarParte(id: number): void {
    if (this.pagosDivididos().length <= 2) return;
    this.pagosDivididos.update(pagos => pagos.filter(pago => pago.id !== id));
  }

  cambiarMetodoParte(id: number, metodoPago: PaymentMethodType): void {
    this.pagosDivididos.update(pagos => pagos.map(pago => pago.id !== id ? pago : {
      ...pago,
      metodoPago,
      montoRecibido: metodoPago === 'qr' ? pago.montoAplicado : Math.max(pago.montoAplicado, pago.montoRecibido),
    }));
  }

  cambiarMontoParte(id: number, valor: string): void {
    const montoAplicado = this.roundCurrency(Math.max(0, Number(valor) || 0));
    this.pagosDivididos.update(pagos => pagos.map(pago => pago.id !== id ? pago : {
      ...pago,
      montoAplicado,
      montoRecibido: pago.metodoPago === 'qr' ? montoAplicado : Math.max(montoAplicado, pago.montoRecibido),
    }));
  }

  cambiarRecibidoParte(id: number, valor: string): void {
    const montoRecibido = this.roundCurrency(Math.max(0, Number(valor) || 0));
    this.pagosDivididos.update(pagos => pagos.map(pago => pago.id === id ? { ...pago, montoRecibido } : pago));
  }

  completarRestante(id: number): void {
    const otrasPartes = this.pagosDivididos()
      .filter(pago => pago.id !== id)
      .reduce((total, pago) => total + Number(pago.montoAplicado || 0), 0);
    this.cambiarMontoParte(id, String(Math.max(0, this.roundCurrency(this.getTargetAmount() - otrasPartes))));
  }

  cambioParte(pago: SplitPaymentLine): number {
    return pago.metodoPago === 'efectivo'
      ? Math.max(0, this.roundCurrency(pago.montoRecibido - pago.montoAplicado))
      : 0;
  }

  getSplitConfirmButtonLabel(): string {
    if (this.isProcessing()) return 'Procesando...';
    if (!this.pagoDivididoValido()) {
      return this.saldoDividido() < 0
        ? `Excede por ${formatCurrency(Math.abs(this.saldoDividido()))}`
        : 'Completa los montos';
    }
    return this.saldoDividido() > 0
      ? `Registrar · faltan ${formatCurrency(this.saldoDividido())}`
      : 'Completar pago dividido';
  }

  private nuevaParte(metodoPago: PaymentMethodType): SplitPaymentLine {
    return { id: this.siguientePagoId++, metodoPago, montoAplicado: 0, montoRecibido: 0 };
  }

  private roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  formatPrice(price: number): string {
    return formatCurrency(price);
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
        return `Falta devolver ${formatCurrency(remainingToPay)}`;
      }
      return this.estadoPago() === 'excess'
        ? `Completar pago y devolver ${formatCurrency(this.cambio())}`
        : 'Registrar devolución';
    }

    if (this.estadoPago() === 'insufficient') {
      return `Continuar con la deuda de ${formatCurrency(remainingToPay)}`;
    }

    if (this.estadoPago() === 'excess') {
      return `Completar pago y devolver ${formatCurrency(this.cambio())}`;
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
  trackBySplitPayment = (_index: number, pago: SplitPaymentLine) => pago.id;
}
