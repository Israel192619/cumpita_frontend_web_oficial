import { vi } from 'vitest';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { CocinaHome, compararLlegadaKds, conservarPosicionesSalida, construirColaAsistenteKds, fusionarPedidosKds } from './cocina-home';

describe('Asistente de Cocina y Parrilla', () => {
  const orden = (id: number, fecha: string, estado = 'pendiente', extra: any = {}) => ({
    id, numero_orden: id, created_at: fecha, fecha_orden: fecha, estado: 'preparando', tipo_orden: 'dine-in',
    detalles: [{ id: id * 10, cantidad: 1, estado_cocina: estado, bloqueado: false, producto: { id, nombre: `Pescado ${id}` } }],
    ...extra,
  }) as any;

  it('recomienda primero la preorden activada y conserva tres tareas siguientes', () => {
    const normalAntigua = orden(1, '2026-09-25T11:00:00');
    const normalNueva = orden(2, '2026-09-25T11:10:00');
    const preorden = orden(3, '2026-09-25T11:20:00', 'pendiente', { tipo_flujo: 'preorden', estado_preorden: 'activada' });
    const cola = construirColaAsistenteKds([normalNueva, normalAntigua, preorden], new Date('2026-09-25T11:30:00').getTime());
    expect(cola.map(tarea => tarea.orden.id)).toEqual([3, 1, 2]);
    expect(cola[0].motivo).toContain('Preorden activada');
  });

  it('omite productos terminados y fichas bloqueadas', () => {
    const terminada = orden(1, '2026-09-25T11:00:00', 'servido');
    const bloqueada = orden(2, '2026-09-25T11:01:00');
    bloqueada.detalles[0].bloqueado = true;
    const activa = orden(3, '2026-09-25T11:02:00');
    expect(construirColaAsistenteKds([terminada, bloqueada, activa]).map(tarea => tarea.orden.id)).toEqual([3]);
  });

  it('no mueve ni selecciona toda la ficha solo por contener una sopa', () => {
    const antigua = orden(1, '2026-09-25T11:00:00');
    const sopa = orden(2, '2026-09-25T11:20:00');
    sopa.detalles[0].producto = { id: 2, nombre: 'Sopa de pollo', categoria: { id: 4, nombre: 'Sopas' } };
    const cola = construirColaAsistenteKds([antigua, sopa], new Date('2026-09-25T11:30:00').getTime());
    expect(cola.map(tarea => tarea.orden.id)).toEqual([1]);
    expect([antigua, sopa].sort(compararLlegadaKds).map(item => item.id)).toEqual([1, 2]);
  });

  it('mantiene las subcategorias locales de bebidas fuera de la prioridad de ficha', () => {
    const gaseosa = orden(1, '2026-09-25T11:00:00');
    gaseosa.detalles[0].producto = { id: 1, nombre: 'Coca Cola', categoria: { id: 2, nombre: 'Gaseosas' } };
    expect(construirColaAsistenteKds([gaseosa], new Date('2026-09-25T11:01:00').getTime())).toEqual([]);
  });

  it('espera a Parrilla antes de priorizar una ficha con pollo y pescado', () => {
    const mixta = orden(1, '2026-09-25T11:00:00');
    mixta.detalles = [
      { id: 11, cantidad: 1, estado_cocina: 'pendiente', bloqueado: false, producto: { id: 1, nombre: 'Pollo', categoria: { id: 1, nombre: 'Pollos' } } },
      { id: 12, cantidad: 1, estado_cocina: 'pendiente', bloqueado: true, producto: { id: 2, nombre: 'Pescado', categoria: { id: 2, nombre: 'Pescados' } } },
    ];
    expect(construirColaAsistenteKds([mixta])).toEqual([]);
    mixta.detalles[1].bloqueado = false;
    mixta.detalles[1].listo_para_atender = true;
    expect(construirColaAsistenteKds([mixta])[0].tipo).toBe('dependencia');
  });
});

describe('Sincronización del monitor de Cocina', () => {
  it('abre y cierra el conteo grande cuando existe producción pendiente', () => {
    const component = Object.create(CocinaHome.prototype) as any;
    component.resumenProduccionAbierto = signal(false);
    component.tieneProduccionPendiente = () => true;

    component.abrirResumenProduccion();
    expect(component.resumenProduccionAbierto()).toBe(true);

    component.cerrarResumenProduccion();
    expect(component.resumenProduccionAbierto()).toBe(false);
  });

  it('muestra durante 20 segundos cada venta de pescados en el orden recibido', () => {
    vi.useFakeTimers();
    try {
      const component = Object.create(CocinaHome.prototype) as any;
      component.colaAlertasParrilla = [];
      component.alertaParrillaActual = signal(null);
      component.segundosAlertaParrilla = signal(20);
      component.document = { visibilityState: 'visible' };
      const orden = (id: number, nombre: string, cantidad: number, precio: number) => ({
        id,
        detalles: [{
          cantidad,
          precio_unitario: precio,
          incluye_producto: true,
          producto: { id, nombre, categoria: { id: 1, nombre: 'Pescados' } },
        }],
      });

      expect(component.encolarAlertaParrilla(orden(1, 'Pescado grande', 2, 50))).toBe(true);
      expect(component.encolarAlertaParrilla(orden(2, 'Pescado mediano', 3, 45))).toBe(true);
      expect(component.alertaParrillaActual().productos).toEqual([{ nombre: 'Pescado grande', cantidad: 2, precio: 50 }]);

      vi.advanceTimersByTime(20000);
      expect(component.alertaParrillaActual().productos).toEqual([{ nombre: 'Pescado mediano', cantidad: 3, precio: 45 }]);

      component.aceptarAlertaParrilla();
      expect(component.alertaParrillaActual()).toBeNull();
    } finally { vi.useRealTimers(); }
  });

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
  it('mantiene el orden de llegada y deja las preordenes anticipadas al final', () => {
    const normal = ficha(1), activada = ficha(2, { tipo_flujo: 'preorden', estado_preorden: 'activada', preorden_activada_en: '2026-09-21T10:00:02' });
    const anticipada = ficha(3, { preorden_temprana: true, fecha_programada: '2026-09-21T11:00:00' });
    expect(fusionarPedidosKds([normal, anticipada], [activada], [2]).map(o => o.id)).toEqual([1, 2, 3]);
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
