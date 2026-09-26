import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CheckoutModalComponent } from './checkout-modal';

describe('CheckoutModalComponent pago dividido', () => {
  let fixture: ComponentFixture<CheckoutModalComponent>;
  let component: CheckoutModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CheckoutModalComponent] }).compileComponents();
    fixture = TestBed.createComponent(CheckoutModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('total', 120);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    component.activarPagoDividido(true);
  });

  it('divide una cuenta entre QR y efectivo y calcula el cambio de cada parte', () => {
    const [qr, efectivo] = component.pagosDivididos();
    component.cambiarMontoParte(qr.id, '70');
    component.cambiarMontoParte(efectivo.id, '50');
    component.cambiarRecibidoParte(efectivo.id, '100');

    expect(component.totalDividido()).toBe(120);
    expect(component.saldoDividido()).toBe(0);
    expect(component.cambioParte(component.pagosDivididos()[1])).toBe(50);
    expect(component.pagoDivididoValido()).toBe(true);
  });

  it('completa el saldo restante sin cálculos manuales', () => {
    const [primero, segundo] = component.pagosDivididos();
    component.cambiarMontoParte(primero.id, '47');
    component.completarRestante(segundo.id);

    expect(component.pagosDivididos()[1].montoAplicado).toBe(73);
    expect(component.saldoDividido()).toBe(0);
  });

  it('emite todas las partes en una sola confirmación', () => {
    const [qr, efectivo] = component.pagosDivididos();
    component.cambiarMontoParte(qr.id, '70');
    component.cambiarMontoParte(efectivo.id, '50');
    component.cambiarRecibidoParte(efectivo.id, '100');
    let salida: any;
    component.checkoutConfirmed.subscribe(valor => salida = valor);

    component.onConfirm();

    expect(salida.pagosDivididos).toEqual([
      { metodoPago: 'qr', montoAplicado: 70, montoRecibido: 70 },
      { metodoPago: 'efectivo', montoAplicado: 50, montoRecibido: 100 },
    ]);
  });

  it('mantiene activo el input mientras se escribe un monto', () => {
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('.split-payment-row input') as HTMLInputElement;
    input.focus();
    input.value = '4';
    input.dispatchEvent(new Event('input'));

    fixture.detectChanges();

    const inputDespues = fixture.nativeElement.querySelector('.split-payment-row input') as HTMLInputElement;
    expect(inputDespues).toBe(input);
    expect(document.activeElement).toBe(input);
  });
});
