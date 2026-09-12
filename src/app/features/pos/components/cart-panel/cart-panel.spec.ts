import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { ConfiguracionService } from '@app/core/services/configuracion-service';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog-service';
import { CartItem, PosService } from '../../services/pos-service';
import { CartPanelComponent } from './cart-panel';
import { ModificadorEstructurado, ModificadorOpcion } from '@app/core/models/producto';

function crearComponente() {
  TestBed.configureTestingModule({
    imports: [CartPanelComponent],
    providers: [
      { provide: PosService, useValue: {} },
      { provide: ConfirmDialogService, useValue: {} },
      { provide: ToastrService, useValue: {} },
      { provide: ConfiguracionService, useValue: { cargar: () => of({}) } },
    ],
  }).overrideComponent(CartPanelComponent, { set: { template: '', imports: [], styles: [], styleUrls: [] } });
  return TestBed.createComponent(CartPanelComponent);
}

describe('Editor de modificadores del carrito agrupado', () => {
  it('abre sin ciclos y solo refresca el editor cuando cambia el producto', () => {
    const fixture = crearComponente();
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

  it('permite quitar una opción concreta y elegir su reemplazo cuando el grupo exige cuatro', () => {
    const fixture = crearComponente();
    const component = fixture.componentInstance;
    const opciones: ModificadorOpcion[] = [
      { id: 1, nombre: 'Yuca', precio_extra: 0, activo: true, predeterminado: true },
      { id: 2, nombre: 'Ensalada', precio_extra: 0, activo: true, predeterminado: true },
      { id: 3, nombre: 'Mote', precio_extra: 0, activo: true, predeterminado: true },
      { id: 4, nombre: 'Papas fritas', precio_extra: 0, activo: true, predeterminado: false },
      { id: 5, nombre: 'Arroz batido', precio_extra: 0, activo: true, predeterminado: false },
    ];
    const grupo: ModificadorEstructurado = {
      id: 10,
      nombre: 'Guarniciones',
      tipo: 'multiple',
      requerido: true,
      cantidad_requerida: 4,
      activo: true,
      opciones,
    };
    component.modifierModalItem.set({
      id: 1,
      cantidad: 1,
      precio_unitario: 10,
      subtotal: 10,
      producto: { id: 1, categoria_id: 1, nombre: 'Pescado', precio: 10, activo: true, maneja_stock: false },
    });
    component.draftModifiers.set(opciones.slice(0, 4).map(opcion => ({
      modificador_id: grupo.id,
      opcion_id: opcion.id,
      opcion_nombre: opcion.nombre,
      precio_extra: opcion.precio_extra,
    })));

    component.toggleModifierOption(grupo, opciones[1]);
    expect(component.draftModifiers().map(mod => mod.opcion_id)).toEqual([1, 3, 4]);
    expect(component.getModifierGroupQuantity(grupo)).toBe(3);

    component.toggleModifierOption(grupo, opciones[4]);
    expect(component.draftModifiers().map(mod => mod.opcion_id)).toEqual([1, 3, 4, 5]);
    expect(component.modifierSelectionError()).toBeNull();
    fixture.destroy();
  });

  it('no reemplaza opciones automáticamente cuando el límite ya está completo', () => {
    const fixture = crearComponente();
    const component = fixture.componentInstance;
    const seleccionadas: ModificadorOpcion[] = [1, 2, 3, 4].map(id => ({
      id,
      nombre: `Opción ${id}`,
      precio_extra: 0,
      activo: true,
      predeterminado: id < 4,
    }));
    const nueva: ModificadorOpcion = { id: 5, nombre: 'Opción 5', precio_extra: 0, activo: true, predeterminado: false };
    const grupo: ModificadorEstructurado = {
      id: 20,
      nombre: 'Guarniciones',
      tipo: 'multiple',
      requerido: true,
      cantidad_requerida: 4,
      activo: true,
      opciones: [...seleccionadas, nueva],
    };
    component.modifierModalItem.set({
      id: 2,
      cantidad: 1,
      precio_unitario: 10,
      subtotal: 10,
      producto: { id: 2, categoria_id: 1, nombre: 'Pescado', precio: 10, activo: true, maneja_stock: false },
    });
    component.draftModifiers.set(seleccionadas.map(opcion => ({
      modificador_id: grupo.id,
      opcion_id: opcion.id,
      opcion_nombre: opcion.nombre,
      precio_extra: opcion.precio_extra,
    })));

    component.toggleModifierOption(grupo, nueva);

    expect(component.draftModifiers().map(mod => mod.opcion_id)).toEqual([1, 2, 3, 4]);
    expect(component.modifierSelectionError()).toContain('Quita una opción para seleccionar otra');
    fixture.destroy();
  });
});
