import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '@app/core/services/auth-service';
import { ThemeService } from '@app/core/services/theme-service';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog-service';
import { CategoriaService } from '@app/features/categorias/services/categoria-service';
import { ProductoService } from '@app/features/productos/services/producto-service';
import { ReverbService } from '@app/core/services/reverb-service';
import { PosService, Order } from '../../services/pos-service';
import { PosHome } from './pos-home';
import { Producto } from '@app/core/models/producto';
import { OfflineSalesService } from '../../services/offline-sales-service';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';

function crearComponente() {
  TestBed.configureTestingModule({
      imports: [PosHome],
      providers: [
        { provide: PosService, useValue: {} },
        { provide: OfflineSalesService, useValue: {
          pendingCount: signal(0), syncing: signal(false), needsAttention: signal(0),
          synced: new Subject<number>(), start: () => Promise.resolve(), stop: () => undefined,
        } },
        { provide: CategoriaService, useValue: {} },
        { provide: ProductoService, useValue: {} },
        { provide: ToastrService, useValue: { error: () => undefined, info: () => undefined } },
        { provide: ActivatedRoute, useValue: { snapshot: { data: {} } } },
        { provide: Router, useValue: {} },
        { provide: ConfirmDialogService, useValue: {} },
        { provide: ReverbService, useValue: {} },
        { provide: AuthService, useValue: {} },
        { provide: ThemeService, useValue: {} },
      ],
  }).overrideComponent(PosHome, { set: { template: '', imports: [], styles: [], styleUrls: [] } });
  const component = TestBed.createComponent(PosHome).componentInstance;
  (component as any).liberarReservas = () => {};
  return component;
}

describe('Reinicio del POS después de cobrar', () => {
  beforeEach(() => localStorage.clear());

  it('descarta los pagos del pedido anterior antes de empezar otra venta', () => {
    const component = crearComponente();
    component.editingOrder.set({
      id: 1,
      total: 200,
      pagos: [{ monto_pagado: 200 }],
    } as Order);
    component.isEditingOrder.set(true);
    expect(component.paidAmount()).toBe(200);

    // El pago se completó; el siguiente cliente lleva productos por Bs 40.
    (component as any).liberarReservas = () => {};
    (component as any).finalizarVenta(false);
    component.carrito.set([{
      id: 2,
      cantidad: 1,
      precio_unitario: 40,
      subtotal: 40,
      producto: { id: 2, nombre: 'Nuevo producto' },
    }] as any);

    expect(component.editingOrder()).toBeNull();
    expect(component.paidAmount()).toBe(0);
    expect(component.total()).toBe(40);
  });

  it('recupera el pedido en proceso después de recargar la pantalla', () => {
    const original = crearComponente();
    original.carrito.set([{
      id: 44,
      cantidad: 2,
      precio_unitario: 45,
      subtotal: 90,
      producto: { id: 5, nombre: 'Pescado mediano', activo: true },
      nota: 'Sin limón',
      modificadores: [{ modificador_id: 1, opcion_id: 4, opcion_nombre: 'Ensalada', precio_extra: 0 }],
    }] as any);
    original.selectedCliente.set({ id: 7, nombre: 'Cliente prueba', telefono: '70000000' });
    original.orderType.set('delivery');
    original.orderComment.set('Entregar todo junto');
    (original as any).persistCurrentDraft();

    original.carrito.set([]);
    original.selectedCliente.set(null);
    original.orderType.set('dine-in');
    original.orderComment.set('');
    (original as any).restoreSavedDraft();

    expect(original.carrito()).toHaveLength(1);
    expect(original.carrito()[0].cantidad).toBe(2);
    expect(original.carrito()[0].nota).toBe('Sin limón');
    expect(original.selectedCliente()?.nombre).toBe('Cliente prueba');
    expect(original.orderType()).toBe('delivery');
    expect(original.orderComment()).toBe('Entregar todo junto');
  });

  it('elimina el borrador cuando la venta termina correctamente', () => {
    const component = crearComponente();
    component.carrito.set([{
      id: 45,
      cantidad: 1,
      precio_unitario: 60,
      subtotal: 60,
      producto: { id: 7, nombre: 'Pescado desespinado', activo: true },
    }] as any);
    component.selectedCliente.set({ id: 8, nombre: 'Cliente' });
    (component as any).persistCurrentDraft();

    expect(localStorage.length).toBe(1);
    (component as any).finalizarVenta(false);
    expect(localStorage.length).toBe(0);
  });

  it('al cancelar elimina también las copias creadas antes de identificar al cajero', () => {
    const component = crearComponente();
    localStorage.setItem('tonito-order-draft-v1:current:pos', '{}');
    localStorage.setItem('tonito-order-draft-v2:pos', '{}');

    component.onCartCleared();

    expect(localStorage.getItem('tonito-order-draft-v1:current:pos')).toBeNull();
    expect(localStorage.getItem('tonito-order-draft-v2:pos')).toBeNull();
  });

  it('abre el selector si se desactiva una presa predeterminada de un pollo doble', () => {
    const component = crearComponente();
    const producto: Producto = {
      id: 9, categoria_id: 1, nombre: 'Pollo doble presa', precio: 28,
      activo: true, maneja_stock: false, modificadores: [{
        id: 4, nombre: 'Presas de pollo', tipo: 'multiple', requerido: true,
        cantidad_requerida: 2, cantidad_es_maxima: false, activo: true, opciones: [
          { id: 13, nombre: 'Ala', precio_extra: 0, predeterminado: true, activo: true },
          { id: 14, nombre: 'Entre pierna', precio_extra: 0, predeterminado: true, activo: false },
          { id: 15, nombre: 'Pecho', precio_extra: 0, predeterminado: false, activo: true },
        ],
      }],
    };
    expect((component as any).getDefaultModifierStockProblem(producto, 1)).toContain('exactamente 2');
    component.carrito.set([{
      id: 1, producto, cantidad: 1, precio_unitario: 28, subtotal: 28,
      modificadores: [{ modificador_id: 4, opcion_id: 13, opcion_nombre: 'Ala', precio_extra: 0 }],
    }]);
    expect((component as any).stopIfModifierStockIsInsufficient()).toBe(true);
  });
});
