import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { Producto } from '../../../../core/models/producto';
import { construirColaAsistenteServicio, seleccionarOfertaAsistenteMesero, ServicioHome } from './servicio-home';

describe('Asistente de Servicio', () => {
  const ficha = (cambios: any = {}) => ({
    id: 1,
    numero_orden: 10,
    tipo_orden: 'dine-in',
    estado: 'preparando',
    hora: '12:00',
    tiempo_espera_minutos: 8,
    detalles: [{ id: 11, cantidad: 1, producto: 'Pescado', opciones: [], listo: false, servido: false }],
    listos: 0,
    total_items: 1,
    todo_listo: false,
    cubiertos_entregados: false,
    created_at: '2026-09-25T12:00:00-04:00',
    ...cambios,
  });

  it('prioriza una ficha propia completa antes de tomar otra ficha', () => {
    const propia = ficha({ id: 1, numero_orden: 20, todo_listo: true, cubiertos_entregados: true, detalles: [{ id: 11, cantidad: 1, producto: 'Pescado', opciones: [], listo: true, servido: true }] });
    const disponible = ficha({ id: 2, numero_orden: 10, tiempo_espera_minutos: 30 });
    const cola = construirColaAsistenteServicio([propia], [disponible]);
    expect(cola[0].accion).toBe('entregar');
    expect(cola[0].ficha.id).toBe(1);
  });

  it('indica cubiertos antes de entregar una ficha lista', () => {
    const lista = ficha({ todo_listo: true, cubiertos_entregados: false, detalles: [{ id: 11, cantidad: 1, producto: 'Pescado', opciones: [], listo: true, servido: true }] });
    const cola = construirColaAsistenteServicio([lista], []);
    expect(cola[0].accion).toBe('cubiertos');
  });

  it('no selecciona toda la ficha solamente por contener una bebida inmediata', () => {
    const propia = ficha({ detalles: [{ id: 11, cantidad: 1, producto: 'Mocochinchi', categoria: 'Bebidas', opciones: [], listo: false, servido: false }] });
    const cola = construirColaAsistenteServicio([propia], [ficha({ id: 2 })]);
    expect(cola[0].ficha.id).toBe(2);
    expect(cola.find(tarea => tarea.ficha.id === propia.id)?.accion).toBe('esperar');
    expect(cola.find(tarea => tarea.ficha.id === propia.id)?.puntaje).toBe(16);
  });

  it('espera el pedido principal completo y conserva aparte la señal de sopa o bebida', () => {
    const propia = ficha({ detalles: [
      { id: 11, cantidad: 2, producto: 'Mocochinchi', categoria: 'Bebidas', opciones: [], listo: false, servido: false },
      { id: 12, cantidad: 1, producto: 'Sopa', categoria: 'Sopas', opciones: [], listo: false, servido: false },
      { id: 13, cantidad: 1, producto: 'Pescado', categoria: 'Pescados', opciones: [], listo: true, servido: false },
    ] });
    const component = Object.create(ServicioHome.prototype) as ServicioHome;
    const cola = construirColaAsistenteServicio([propia], []);
    expect(cola[0].accion).toBe('esperar');
    expect(cola[0].titulo).toBe('PRÓXIMA A SERVIR');
    expect(component.tieneSalidaInmediataServicio(propia)).toBe(true);
    expect(component.esGrupoSalidaInmediataServicio({
      categoria: 'Sopas', producto: 'Sopa', listo: false, detalles: [propia.detalles[1]],
    } as any)).toBe(true);
  });

  it('nombra exactamente sopa, bebida o ambas y oculta la señal al servirlas', () => {
    const component = Object.create(ServicioHome.prototype) as ServicioHome;
    const pedido = ficha({ detalles: [
      { id: 11, cantidad: 1, producto: 'Sopa de maní', categoria: 'Sopas', opciones: [], listo: false, servido: false },
      { id: 12, cantidad: 1, producto: 'Mocochinchi', categoria: 'Bebidas', opciones: [], listo: false, servido: false },
    ] });
    expect(component.etiquetaSalidaInmediataServicio(pedido)).toBe('SOPA Y BEBIDA · SERVIR PRIMERO');
    pedido.detalles[1].servido = true;
    expect(component.etiquetaSalidaInmediataServicio(pedido)).toBe('SOPA · SERVIR PRIMERO');
    pedido.detalles[0].servido = true;
    expect(component.tieneSalidaInmediataServicio(pedido)).toBe(false);
  });

  it('ofrece una ficha normal hasta completar dos responsabilidades', () => {
    const disponibles = [ficha({ id: 2 })];
    const oferta = seleccionarOfertaAsistenteMesero([ficha({ id: 1 })], disponibles, disponibles, 7, {}, 1000);
    expect(oferta?.tipo).toBe('asignacion');
    expect(oferta?.ficha.id).toBe(2);
  });

  it('ofrece apoyo urgente sin añadir una tercera ficha y respeta pasar a otro', () => {
    const propias = [ficha({ id: 1 }), ficha({ id: 2 })];
    const lista = ficha({ id: 3, todo_listo: true });
    expect(seleccionarOfertaAsistenteMesero(propias, [lista], [lista], 7, {}, 1000)?.tipo).toBe('apoyo');
    expect(seleccionarOfertaAsistenteMesero(propias, [lista], [lista], 7, { '7:ficha:3': 2000 }, 1000)).toBeNull();
  });

  it('prioriza el trabajo propio urgente antes de ofrecer ayuda', () => {
    const propias = [ficha({ id: 1, todo_listo: true }), ficha({ id: 2 })];
    const lista = ficha({ id: 3, todo_listo: true });
    expect(seleccionarOfertaAsistenteMesero(propias, [lista], [lista], 7, {}, 1000)).toBeNull();
  });

  it('mantiene la confirmación de una ayuda ya reservada por el mesero', () => {
    const reservada = ficha({ id: 3, todo_listo: true, apoyo_por_id: 7, apoyo_por: 'Mesero A' });
    const oferta = seleccionarOfertaAsistenteMesero([ficha({ id: 1 }), ficha({ id: 2 })], [reservada], [reservada], 7, {}, 1000);
    expect(oferta?.tipo).toBe('apoyo_reservado');
  });

  it('ofrece una sopa de cualquier ficha aunque el mesero ya tenga dos', () => {
    const propias = [ficha({ id: 1 }), ficha({ id: 2 })];
    const lejana = ficha({ id: 9, numero_orden: 30, mesero_id: 15, detalles: [
      { id: 91, cantidad: 2, producto: 'Sopa de maní', categoria: 'Sopas', opciones: [], listo: false, servido: false },
    ] });
    const oferta = seleccionarOfertaAsistenteMesero(propias, [], [lejana], 7, {}, 1000);
    expect(oferta?.tipo).toBe('salida_inmediata');
    expect(oferta?.detalle?.id).toBe(91);
    expect(oferta?.ficha.id).toBe(9);
  });

  it('pide confirmar una bebida reservada por el mismo mesero', () => {
    const bebida = ficha({ id: 9, detalles: [
      { id: 91, cantidad: 1, producto: 'Mocochinchi', categoria: 'Bebidas', opciones: [], listo: false, servido: false, llevando_por_id: 7 },
    ] });
    const oferta = seleccionarOfertaAsistenteMesero([], [], [bebida], 7, {}, 1000);
    expect(oferta?.tipo).toBe('salida_reservada');
  });

  it('no ofrece una salida inmediata que lleva otro mesero', () => {
    const bebida = ficha({ id: 9, detalles: [
      { id: 91, cantidad: 1, producto: 'Refresco', categoria: 'Bebidas', opciones: [], listo: false, servido: false, llevando_por_id: 8 },
    ] });
    expect(seleccionarOfertaAsistenteMesero([ficha({ id: 1 }), ficha({ id: 2 })], [], [bebida], 7, {}, 1000)).toBeNull();
  });

  it('no adelanta sopas ni bebidas de fichas para llevar', () => {
    const paraLlevar = ficha({ id: 9, tipo_orden: 'to-go', detalles: [
      { id: 91, cantidad: 1, producto: 'Sopa', categoria: 'Sopas', opciones: [], listo: false, servido: false },
    ] });
    expect(seleccionarOfertaAsistenteMesero([ficha({ id: 1 }), ficha({ id: 2 })], [], [paraLlevar], 7, {}, 1000)).toBeNull();
  });

  it('hace una pausa antes de mostrar otra recomendación al mismo mesero', () => {
    const disponible = ficha({ id: 3 });
    expect(seleccionarOfertaAsistenteMesero([], [disponible], [disponible], 7, { '7:pausa': 2000 }, 1000)).toBeNull();
  });

  it('mantiene visible una entrega ya reservada aunque exista una pausa', () => {
    const bebida = ficha({ id: 9, detalles: [
      { id: 91, cantidad: 1, producto: 'Refresco', categoria: 'Bebidas', opciones: [], listo: false, servido: false, llevando_por_id: 7 },
    ] });
    expect(seleccionarOfertaAsistenteMesero([], [], [bebida], 7, { '7:pausa': 2000 }, 1000)?.tipo).toBe('salida_reservada');
  });
});

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
  it('abre el selector de inmediato aunque cubiertos siga procesandose', () => {
    const component = Object.create(ServicioHome.prototype) as any;
    const respuesta = new Subject<any>();
    const ficha = { id: 8, numero_orden: 25, mesa: null, tipo_orden: 'dine-in' };
    component.fichaMesa = signal(null);
    component.mesasDisponibles = signal([]);
    component.seleccionMesaAbierta = signal(false);
    component.cargandoMesas = signal(false);
    component.procesando = signal('cubiertos-8');
    component.requerirSesion = () => ({ token: 'sesion-mesero' });
    component.servicio = { listarMesas: () => respuesta };
    component.toastr = { error: () => {} };

    component.abrirMesas(ficha);

    expect(component.seleccionMesaAbierta()).toBe(true);
    expect(component.fichaMesa()).toBe(ficha);
    expect(component.cargandoMesas()).toBe(true);
    respuesta.next({ mesas: [{ id: 4, numero: '4' }] });
    expect(component.mesasDisponibles()).toEqual([{ id: 4, numero: '4' }]);
    expect(component.cargandoMesas()).toBe(false);
  });

  it('usa la sesion del mesero y actualiza las fichas solo al confirmar el servidor', () => {
    const component = Object.create(ServicioHome.prototype) as any;
    const respuesta = new Subject<any>();
    const ficha = { id: 8, numero_orden: 25, mesa: null, tipo_orden: 'dine-in' };
    const llamadas: any[] = [];
    component.fichaMesa = signal(ficha);
    component.asignandoMesaId = signal(null);
    component.procesando = signal('cubiertos-8');
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
    expect(component.asignandoMesaId()).toBeNull();
  });
});
