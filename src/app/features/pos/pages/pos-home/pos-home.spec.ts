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

function crearComponente() {
  TestBed.configureTestingModule({
      imports: [PosHome],
      providers: [
        { provide: PosService, useValue: {} },
        { provide: CategoriaService, useValue: {} },
        { provide: ProductoService, useValue: {} },
        { provide: ToastrService, useValue: { error: () => undefined } },
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
