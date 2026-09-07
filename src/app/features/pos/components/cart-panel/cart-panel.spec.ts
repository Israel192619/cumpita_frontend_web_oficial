import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { ConfiguracionService } from '@app/core/services/configuracion-service';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog-service';
import { CartItem, PosService } from '../../services/pos-service';
import { CartPanelComponent } from './cart-panel';

describe('Editor de modificadores del carrito agrupado', () => {
  it('abre sin ciclos y solo refresca el editor cuando cambia el producto', () => {
    TestBed.configureTestingModule({
      imports: [CartPanelComponent],
      providers: [
        { provide: PosService, useValue: {} },
        { provide: ConfirmDialogService, useValue: {} },
        { provide: ToastrService, useValue: {} },
        { provide: ConfiguracionService, useValue: { cargar: () => of({}) } },
      ],
    }).overrideComponent(CartPanelComponent, { set: { template: '', imports: [], styles: [], styleUrls: [] } });
    const fixture = TestBed.createComponent(CartPanelComponent);
    const item: CartItem = { id: 1, cantidad: 1, precio_unitario: 10, subtotal: 10,
      producto: { id: 1, categoria_id: 1, nombre: 'Refresco', precio: 10, activo: true, maneja_stock: false } };
    fixture.componentRef.setInput('items', [item]);
    fixture.detectChanges();
    fixture.componentInstance.openModifierModal(item);
    fixture.detectChanges();
    const abierto = fixture.componentInstance.modifierModalItem();
    expect(fixture.componentInstance.modifierModalOpen()).toBe(true);
    fixture.componentRef.setInput('items', [{ ...item, producto: { ...item.producto } }]);
    fixture.detectChanges();
    expect(fixture.componentInstance.modifierModalItem()).toBe(abierto);
    fixture.componentRef.setInput('items', [{ ...item, producto: { ...item.producto, activo: false } }]);
    fixture.detectChanges();
    expect(fixture.componentInstance.modifierModalItem()?.producto.activo).toBe(false);
    fixture.componentInstance.closeModifierModal();
    fixture.detectChanges();
    expect(fixture.componentInstance.modifierModalOpen()).toBe(false);
    fixture.destroy();
  });
});
