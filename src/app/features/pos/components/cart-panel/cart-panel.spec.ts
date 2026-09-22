import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { ProductoService } from '@app/features/productos/services/producto-service';
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
      { provide: ProductoService, useValue: {} },
      { provide: ConfirmDialogService, useValue: {} },
      { provide: ToastrService, useValue: {} },
      { provide: ConfiguracionService, useValue: { cargar: () => of({}) } },
    ],
  }).overrideComponent(CartPanelComponent, { set: { template: '', imports: [], styles: [], styleUrls: [] } });
  return TestBed.createComponent(CartPanelComponent);
}

describe('Editor de modificadores del carrito agrupado', () => {
  it('cobra directamente cuando el cliente ya está seleccionado', () => {
    const fixture = crearComponente();
    const component = fixture.componentInstance;
    component.selectedCliente.set({ id: 8, nombre: 'Raquel' });
    let checkoutRequests = 0;
    component.checkoutRequested.subscribe(() => checkoutRequests++);

    component.onPrimaryAction();

    expect(checkoutRequests).toBe(1);
    expect(component.showMobileDetails()).toBe(false);
    fixture.destroy();
  });

  it('crea el cliente escrito al cobrar y reutiliza la misma solicitud si también se presiona más', () => {
    const fixture = crearComponente();
    const component = fixture.componentInstance;
    const pending = new Subject<any>();
    let creations = 0;
    TestBed.inject(PosService).crearCliente = () => { creations++; return pending; };
    component.searchQuery.set('Cliente nuevo');
    component.onCreateCliente();
    let checkoutRequests = 0;
    component.checkoutRequested.subscribe(() => checkoutRequests++);

    component.onPrimaryAction();
    expect(creations).toBe(1);
    expect(checkoutRequests).toBe(0);
    pending.next({ id: 12, nombre: 'Cliente nuevo' });
    pending.complete();

    expect(component.selectedCliente()?.id).toBe(12);
    expect(checkoutRequests).toBe(1);
    expect(component.showMobileDetails()).toBe(false);
    fixture.destroy();
  });

  it('despliega los datos solamente cuando no hay cliente ni nombre escrito', () => {
    const fixture = crearComponente();
    const component = fixture.componentInstance;
    let payLaterRequests = 0;
    component.payLaterRequested.subscribe(() => payLaterRequests++);

    component.onPayLater();

    expect(component.showMobileDetails()).toBe(true);
    expect(payLaterRequests).toBe(1);
    fixture.destroy();
  });

  it('recorre clientes con flechas y selecciona con enter', () => {
    const fixture = crearComponente();
    const component = fixture.componentInstance;
    component.clientesResults.set([
      { id: 1, nombre: 'Damaris' },
      { id: 2, nombre: 'Daniela' },
    ]);
    component.selectedSearchResultIndex.set(0);

    component.onClienteSearchKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(component.selectedSearchResultIndex()).toBe(1);
    component.onClienteSearchKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(component.selectedCliente()?.id).toBe(2);
    fixture.destroy();
  });

  it('muestra como tarjeta solo las opciones configuradas con imagen', () => {
    const fixture = crearComponente();
    const component = fixture.componentInstance;
    expect(component.shouldShowOptionImage({
      id: 1, nombre: 'Ala', precio_extra: 0, activo: true, predeterminado: false,
      imagen_url: '/storage/modificadores/opciones/ala.jpg', mostrar_imagen: true,
    })).toBe(true);
    expect(component.shouldShowOptionImage({
      id: 2, nombre: 'Pecho', precio_extra: 0, activo: true, predeterminado: false,
      imagen_url: '/storage/modificadores/opciones/pecho.jpg', mostrar_imagen: false,
    })).toBe(false);
    fixture.destroy();
  });

  it('reabastece una opción sin duplicar solicitudes ni cerrar la selección', () => {
    const fixture = crearComponente();
    const component = fixture.componentInstance;
    const pending = new Subject<any>();
    const requests: any[] = [];
    TestBed.inject(ProductoService).crearAjusteStock = data => { requests.push(data); return pending; };
    TestBed.inject(ToastrService).success = () => undefined as any;
    let refreshed = false;
    component.stockAdjusted.subscribe(() => refreshed = true);
    component.modifierModalOpen.set(true);
    const selected = [{ modificador_id: 4, opcion_id: 13, opcion_nombre: 'Ala', precio_extra: 0 }];
    component.draftModifiers.set(selected);
    component.openOptionRestock({ id: 13, nombre: 'Ala', precio_extra: 0, predeterminado: true, activo: true, maneja_stock: true, stock_disponible: 0 });
    component.restockQuantity.set('7');
    component.confirmOptionRestock();
    component.confirmOptionRestock();
    component.closeOptionRestock();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ modificador_opcion_id: 13, tipo: 'ENTRADA', cantidad: 7 });
    expect(component.restockOption()).not.toBeNull();
    pending.next({});
    pending.complete();
    expect(refreshed).toBe(true);
    expect(component.restockOption()).toBeNull();
    expect(component.modifierModalOpen()).toBe(true);
    expect(component.draftModifiers()).toEqual(selected);
    fixture.destroy();
  });

  it('rechaza cantidades inválidas y conserva el modal si falla el guardado', () => {
    const fixture = crearComponente();
    const component = fixture.componentInstance;
    const pending = new Subject<any>();
    let requests = 0;
    TestBed.inject(ProductoService).crearAjusteStock = () => { requests++; return pending; };
    component.openOptionRestock({ id: 13, nombre: 'Ala', precio_extra: 0, predeterminado: true, activo: true, maneja_stock: true, stock_disponible: 0 });
    for (const value of ['', '0', '-2', '1.5', 'abc']) {
      component.restockQuantity.set(value);
      component.confirmOptionRestock();
      expect(component.restockError()).toContain('entera');
    }
    expect(requests).toBe(0);
    component.restockQuantity.set('5');
    component.confirmOptionRestock();
    pending.error({ error: { message: 'Sin permiso' } });
    expect(component.restockSaving()).toBe(false);
    expect(component.restockOption()?.id).toBe(13);
    expect(component.restockError()).toBe('Sin permiso');
    fixture.destroy();
  });

  it('retira una presa desactivada y exige completar las dos antes de guardar', () => {
    const fixture = crearComponente();
    const component = fixture.componentInstance;
    const grupo: ModificadorEstructurado = {
      id: 4, nombre: 'Presas de pollo', tipo: 'multiple', requerido: true,
      cantidad_requerida: 2, activo: true, opciones: [
        { id: 13, nombre: 'Ala', precio_extra: 0, activo: true, predeterminado: true },
        { id: 14, nombre: 'Entre pierna', precio_extra: 0, activo: false, predeterminado: true },
        { id: 15, nombre: 'Pecho', precio_extra: 0, activo: true, predeterminado: false },
      ],
    };
    const item: CartItem = {
      id: 1, cantidad: 1, precio_unitario: 28, subtotal: 28,
      producto: { id: 9, categoria_id: 1, nombre: 'Pollo doble presa', precio: 28, activo: true, maneja_stock: false, modificadores: [grupo] },
      modificadores: [
        { modificador_id: 4, opcion_id: 13, opcion_nombre: 'Ala', precio_extra: 0 },
        { modificador_id: 4, opcion_id: 14, opcion_nombre: 'Entre pierna', precio_extra: 0 },
      ],
    };
    fixture.componentRef.setInput('items', [item]);
    fixture.detectChanges();
    component.openModifierModal(item);
    expect(component.draftModifiers().map(mod => mod.opcion_id)).toEqual([13]);
    expect(component.modifierSelectionError()).toContain('desactivada');
    component.saveModifierSelection();
    expect(component.modifierSelectionError()).toContain('exactamente 2');
    component.toggleModifierOption(grupo, grupo.opciones![2]);
    expect(component.draftModifiers().map(mod => mod.opcion_id)).toEqual([13, 15]);
    fixture.destroy();
  });

  it('reemplaza con un toque la presa de un grupo de una', () => {
    const fixture = crearComponente();
    const component = fixture.componentInstance;
    const opciones: ModificadorOpcion[] = ['Pecho', 'Ala'].map((nombre, index) => ({
      id: index + 11, nombre, precio_extra: 0, activo: true,
      predeterminado: index === 0, maneja_stock: true, stock_disponible: 9,
    }));
    const grupo: ModificadorEstructurado = {
      id: 12, nombre: 'Presas de pollo', tipo: 'multiple', requerido: true,
      cantidad_requerida: 1, activo: true, opciones,
    };
    component.modifierModalItem.set({
      id: 1, cantidad: 1, precio_unitario: 28, subtotal: 28,
      producto: { id: 1, categoria_id: 1, nombre: 'Pollo una presa', precio: 28, activo: true, maneja_stock: false, modificadores: [grupo] },
    });
    component.draftModifiers.set([{ modificador_id: 12, opcion_id: 11, opcion_nombre: 'Pecho', precio_extra: 0 }]);

    component.toggleModifierOption(grupo, opciones[1]);
    expect(component.draftModifiers().map(mod => mod.opcion_id)).toEqual([12]);
    component.toggleModifierOption(grupo, opciones[1]);
    expect(component.draftModifiers().map(mod => mod.opcion_id)).toEqual([12]);
    fixture.destroy();
  });

  it('reemplaza por FIFO la primera de dos presas y respeta el stock', () => {
    const fixture = crearComponente();
    const component = fixture.componentInstance;
    const opciones: ModificadorOpcion[] = ['Pecho', 'Entre pierna', 'Ala', 'Pierna', 'Agotada'].map((nombre, index) => ({
      id: index + 21, nombre, precio_extra: 0, activo: true,
      predeterminado: index === 0, maneja_stock: true, stock_disponible: index === 4 ? 0 : 9,
    }));
    const grupo: ModificadorEstructurado = {
      id: 22, nombre: 'Presas de pollo', tipo: 'multiple', requerido: true,
      cantidad_requerida: 2, activo: true, opciones,
    };
    component.modifierModalItem.set({
      id: 2, cantidad: 1, precio_unitario: 28, subtotal: 28,
      producto: { id: 2, categoria_id: 1, nombre: 'Pollo doble presa', precio: 28, activo: true, maneja_stock: false, modificadores: [grupo] },
    });
    component.draftModifiers.set([{ modificador_id: 22, opcion_id: 21, opcion_nombre: 'Pecho', precio_extra: 0 }]);

    component.toggleModifierOption(grupo, opciones[1]);
    expect(component.draftModifiers().map(mod => mod.opcion_id)).toEqual([21, 22]);
    component.toggleModifierOption(grupo, opciones[2]);
    expect(component.draftModifiers().map(mod => mod.opcion_id)).toEqual([22, 23]);
    component.toggleModifierOption(grupo, opciones[3]);
    expect(component.draftModifiers().map(mod => mod.opcion_id)).toEqual([23, 24]);
    component.toggleModifierOption(grupo, opciones[0]);
    expect(component.draftModifiers().map(mod => mod.opcion_id)).toEqual([24, 21]);
    component.toggleModifierOption(grupo, opciones[0]);
    expect(component.draftModifiers().map(mod => mod.opcion_id)).toEqual([21, 21]);
    expect(component.getModifierOptionQuantity(grupo, opciones[0])).toBe(2);
    component.toggleModifierOption(grupo, opciones[0]);
    expect(component.draftModifiers().map(mod => mod.opcion_id)).toEqual([21, 21]);
    component.toggleModifierOption(grupo, opciones[4]);
    expect(component.draftModifiers().map(mod => mod.opcion_id)).toEqual([21, 21]);
    expect(component.modifierSelectionError()).toContain('no tiene stock');
    component.draftModifiers.set([
      { modificador_id: 22, opcion_id: 23, opcion_nombre: 'Ala', precio_extra: 0 },
      { modificador_id: 22, opcion_id: 24, opcion_nombre: 'Pierna', precio_extra: 0 },
    ]);
    opciones[0].stock_disponible = 1;
    component.toggleModifierOption(grupo, opciones[0]);
    component.toggleModifierOption(grupo, opciones[0]);
    expect(component.draftModifiers().map(mod => mod.opcion_id)).toEqual([24, 21]);
    expect(component.modifierSelectionError()).toContain('hasta 1 unidades');
    fixture.destroy();
  });

  it('exige quitar manualmente una opción cuando el grupo admite tres', () => {
    const fixture = crearComponente();
    const component = fixture.componentInstance;
    const opciones: ModificadorOpcion[] = [1, 2, 3, 4].map(id => ({
      id, nombre: `Opción ${id}`, precio_extra: 0, activo: true, predeterminado: id <= 3,
    }));
    const grupo: ModificadorEstructurado = {
      id: 33, nombre: 'Grupo de tres', tipo: 'multiple', requerido: true,
      cantidad_requerida: 3, activo: true, opciones,
    };
    component.modifierModalItem.set({
      id: 3, cantidad: 1, precio_unitario: 10, subtotal: 10,
      producto: { id: 3, categoria_id: 1, nombre: 'Producto', precio: 10, activo: true, maneja_stock: false, modificadores: [grupo] },
    });
    component.draftModifiers.set(opciones.slice(0, 3).map(opcion => ({
      modificador_id: 33, opcion_id: opcion.id, opcion_nombre: opcion.nombre, precio_extra: 0,
    })));

    component.toggleModifierOption(grupo, opciones[3]);
    expect(component.draftModifiers().map(mod => mod.opcion_id)).toEqual([1, 2, 3]);
    component.toggleModifierOption(grupo, opciones[0]);
    component.toggleModifierOption(grupo, opciones[3]);
    expect(component.draftModifiers().map(mod => mod.opcion_id)).toEqual([2, 3, 4]);
    fixture.destroy();
  });

  it('permite de cero al límite de guarniciones en pollo y pescado', () => {
    const fixture = crearComponente();
    const component = fixture.componentInstance;
    const opciones: ModificadorOpcion[] = [1, 2, 3, 4, 5].map(id => ({
      id, nombre: `Guarnición ${id}`, precio_extra: 0, activo: true, predeterminado: false,
    }));
    for (const [productoNombre, limite] of [['Pollo', 3], ['Pescado', 4]] as const) {
      const grupo: ModificadorEstructurado = {
        id: 30, nombre: 'Guarniciones', tipo: 'multiple', requerido: true,
        cantidad_requerida: limite, cantidad_es_maxima: true, activo: true, opciones,
      };
      const item: CartItem = {
        id: 1, cantidad: 1, precio_unitario: 10, subtotal: 10,
        producto: { id: 1, categoria_id: 1, nombre: productoNombre, precio: 10, activo: true, maneja_stock: false, modificadores: [grupo] },
      };

      for (let count = 0; count <= limite + 1; count++) {
        component.modifierModalItem.set(item);
        component.draftModifiers.set(opciones.slice(0, count).map(opcion => ({
          modificador_id: grupo.id, opcion_id: opcion.id,
          opcion_nombre: opcion.nombre, precio_extra: 0,
        })));
        component.saveModifierSelection();
        if (count <= limite) expect(component.modifierModalItem()).toBeNull();
        else expect(component.modifierSelectionError()).toContain(`hasta ${limite}`);
      }
    }
    fixture.destroy();
  });

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
      nombre: 'Extras',
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
      nombre: 'Extras',
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
