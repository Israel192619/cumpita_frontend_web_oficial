import { vi } from 'vitest';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { CocinaHome, conservarPosicionesSalida, fusionarPedidosKds } from './cocina-home';

describe('Sincronización del monitor de Cocina', () => {
  it('acepta respuestas lentas sin acumular sondeos y anima la ficha completada', () => {
    const component = Object.create(CocinaHome.prototype) as any;
    const respuesta = new Subject<any>();
    let consultas = 0;
    const salidas: number[] = [];
    const orden = { id: 12, detalles: [{ id: 421, estado_cocina: 'pendiente' }] };
    component.subscriptions = [];
    component.ordenes = signal([orden]);
    component.ordenesVisibles = () => component.ordenes().filter((o: any) => o.detalles.some((d: any) => d.estado_cocina !== 'servido'));
    component.ordenesTablero = () => component.ordenesVisibles();
    component.verServidos = signal(false);
    component.isLoading = signal(false);
    component.fechaSeleccionada = signal('2026-09-20');
    component.estacionSolicitada = signal('cocina');
    component.estacionActual = signal(null);
    component.estacionId = signal(null);
    component.estacionesDisponibles = signal([]);
    component.preordenesProgramadas = signal([]);
    component.tieneCambiosRecientes = () => false;
    component.iniciarSesionKds = () => {};
    component.animarSalidaOrden = (o: any) => salidas.push(o.id);
    component.cocinaService = { obtenerPedidos: () => { consultas++; return respuesta; } };
    component.cargarPedidos(false);
    component.cargarPedidos(false);
    component.cargarPedidos(false);
    expect(consultas).toBe(1);
    respuesta.next({ estacion: { id: 2, codigo: 'COCINA' }, ordenes: [{ ...orden, detalles: [{ id: 421, estado_cocina: 'servido' }] }] });
    expect(component.ordenesVisibles()).toEqual([]);
    expect(salidas).toEqual([12]);
    component.cargarPedidos(false);
    expect(consultas).toBe(2);
  });
});

describe('Posicion de la ficha durante su desaparicion', () => {
  for (const id of [1, 2, 3]) {
    it(`mantiene en su sitio la ficha ${id} aunque cambie la prioridad`, () => {
      const anterior = [1, 2, 3].map(id => ({ id, detalles: [] })) as any[];
      const saliendo = anterior.filter(orden => orden.id === id);
      const nuevaPrioridad = anterior.filter(orden => orden.id !== id).reverse();
      expect(conservarPosicionesSalida(nuevaPrioridad, anterior, saliendo).map(orden => orden.id))
        .toEqual([1, 2, 3]);
      expect(conservarPosicionesSalida(nuevaPrioridad, anterior, saliendo)[id - 1]).toBe(saliendo[0]);
    });
  }
});

describe('Actualizaciones parciales del tablero', () => {
  const ficha = (id: number, extra = {}) => ({ id, created_at: `2026-09-21T10:00:0${id}`, detalles: [], ...extra }) as any;
  it('actualiza o elimina solo las fichas consultadas y conserva las demas', () => {
    const primera = ficha(1), segunda = ficha(2);
    expect(fusionarPedidosKds([primera, segunda], [], [1])).toEqual([segunda]);
    const nueva = ficha(1, { estado: 'listo' });
    expect(fusionarPedidosKds([primera, segunda], [nueva], [1])).toEqual([nueva, segunda]);
    expect(fusionarPedidosKds([primera, segunda], [nueva])).toEqual([nueva]);
  });
  it('mantiene preordenes activadas primero y anticipadas al final', () => {
    const normal = ficha(1), activada = ficha(2, { tipo_flujo: 'preorden', estado_preorden: 'activada' });
    const anticipada = ficha(3, { preorden_temprana: true, fecha_programada: '2026-09-21T11:00:00' });
    expect(fusionarPedidosKds([normal, anticipada], [activada], [2]).map(o => o.id)).toEqual([2, 1, 3]);
  });
  it('agrupa avisos sin perder fichas ni cambios durante una consulta lenta', () => {
    vi.useFakeTimers();
    try {
      const component = Object.create(CocinaHome.prototype) as any;
      component.eventosPendientes = new Map();
      component.estacionActual = () => ({ id: 1 });
      component.cargarPedidos = vi.fn();
      component.cargaPedidosEnCurso = true;
      component.programarActualizacion({ id: 1, nueva: true, cambios: [] });
      component.programarActualizacion({ id: 2, cambios: [{ id: 20 }] });
      component.programarActualizacion({ id: 2, cambios: [{ id: 21 }] });
      vi.advanceTimersByTime(160);
      expect(component.cargarPedidos).not.toHaveBeenCalled();
      component.cargaPedidosEnCurso = false;
      vi.advanceTimersByTime(80);
      expect(component.cargarPedidos).toHaveBeenCalledTimes(1);
      const args = component.cargarPedidos.mock.calls[0];
      expect(args[5]).toEqual([1, 2]);
      expect(args[6][0].nueva).toBe(true);
      expect(args[6][1].cambios).toEqual([{ id: 20 }, { id: 21 }]);
      component.programarActualizacion({ id: 3, cambios: [] });
      component.programarActualizacion();
      vi.advanceTimersByTime(80);
      expect(component.cargarPedidos.mock.calls[1][5]).toBeUndefined();
    } finally { vi.useRealTimers(); }
  });
});
