import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { Producto } from '../../../../core/models/producto';
import { ServicioHome } from './servicio-home';

describe('Stock compartido de adicionales', () => {
  it('pide confirmación para desmarcar lo mostrado aunque exista una copia anterior', () => {
    const component = Object.create(ServicioHome.prototype) as any;
    const respuesta = new Subject<boolean>();
    let confirmaciones = 0;
    let restauraciones = 0;
    component.requerirSesion = () => ({ token: 'mesero' });
    component.confirmacionesPendientes = signal(new Set());
    component.misFichas = signal([{ id: 1, estado: 'preparando', detalles: [{ id: 42, servido: false, producto: 'Pollo' }] }]);
    component.todasFichas = signal([]);
    component.confirmDialog = { confirm: () => { confirmaciones++; return respuesta; } };
    component.desconfirmarDetalle = () => restauraciones++;
    component.confirmar(42, true);
    expect(confirmaciones).toBe(1);
    expect(restauraciones).toBe(0);
    respuesta.next(true);
    expect(restauraciones).toBe(1);
  });
  it('actualiza servido y los contadores de Servicio sin esperar una consulta', () => {
    const component = Object.create(ServicioHome.prototype) as any;
    const ficha = { id: 1, detalles: [{ id: 42, listo: false, servido: false }], listos: 0, todo_listo: false };
    component.misFichas = signal([ficha]);
    component.todasFichas = signal([ficha]);
    component.disponibles = signal([ficha]);
    component.actualizarDetalleLocal(42, true, true);
    for (const fichas of [component.misFichas, component.todasFichas, component.disponibles]) {
      expect(fichas()[0].detalles[0].servido).toBe(true);
      expect(fichas()[0].listos).toBe(1);
      expect(fichas()[0].todo_listo).toBe(true);
    }
    component.actualizarDetalleLocal(42, false, false);
    expect(component.misFichas()[0].listos).toBe(0);
    expect(component.misFichas()[0].detalles[0].servido).toBe(false);
  });
  it('calcula platos por las presas disponibles, incluyendo pollo doble', () => {
    const component = Object.create(ServicioHome.prototype) as ServicioHome;
    const producto = {
      activo: true, maneja_stock: false,
      modificadores: [{ requerido: true, cantidad_requerida: 2, opciones: [
        { id: 1, activo: true, maneja_stock: true, stock: 12, stock_disponible: 3 },
        { id: 2, activo: true, maneja_stock: true, stock: 8, stock_disponible: 2 },
      ] }],
    } as Producto;
    expect(component.stockProducto(producto)).toBe(2);
    expect(component.textoStockProducto(producto)).toBe('2 disponibles');
    producto.modificadores![0].opciones!.forEach(opcion => opcion.stock_disponible = 0);
    expect(component.productoDisponible(producto)).toBe(false);
  });

  it('libera la selección cancelada después de terminar una reserva en vuelo', () => {
    const component = Object.create(ServicioHome.prototype) as any;
    const respuestas: Subject<unknown>[] = [];
    const demandas: unknown[] = [];
    component.reservando = signal(false);
    component.reservaSesion = 'sesion';
    component.servicio = { sincronizarReservas: (_: string, items: unknown[], opciones: unknown[]) => {
      demandas.push({ items, opciones });
      const respuesta = new Subject<unknown>();
      respuestas.push(respuesta);
      return respuesta;
    } };
    component.encolarReserva({ items: [{ producto_id: 1, cantidad: 1 }], opciones: [] });
    component.encolarReserva({ items: [], opciones: [] });
    expect(demandas.length).toBe(1);
    respuestas[0].next({});
    expect(demandas).toEqual([
      { items: [{ producto_id: 1, cantidad: 1 }], opciones: [] },
      { items: [], opciones: [] },
    ]);
    respuestas[1].next({});
    expect(component.reservando()).toBe(false);
  });
});

describe('Mesas de Servicio', () => {
  it('usa la sesion del mesero y actualiza las fichas solo al confirmar el servidor', () => {
    const component = Object.create(ServicioHome.prototype) as any;
    const respuesta = new Subject<any>();
    const ficha = { id: 8, numero_orden: 25, mesa: null, tipo_orden: 'dine-in' };
    const llamadas: any[] = [];
    component.fichaMesa = signal(ficha);
    component.procesando = signal(null);
    component.requerirSesion = () => ({ token: 'sesion-mesero' });
    for (const nombre of ['misFichas', 'todasFichas', 'disponibles', 'preordenesProgramadas']) component[nombre] = signal([ficha]);
    component.servicio = { actualizarMesa: (...args: any[]) => { llamadas.push(args); return respuesta; } };
    component.toastr = { success: () => {}, error: () => {} };
    component.cargar = () => {};
    component.asignarMesa({ id: 4, numero: '4' });
    expect(llamadas).toEqual([[8, 4, 'sesion-mesero']]);
    expect(component.misFichas()[0].mesa).toBeNull();
    respuesta.next({ orden_id: 8, mesa: '4' });
    for (const nombre of ['misFichas', 'todasFichas', 'disponibles', 'preordenesProgramadas']) expect(component[nombre]()[0].mesa).toBe('4');
    expect(component.procesando()).toBeNull();
  });
});
