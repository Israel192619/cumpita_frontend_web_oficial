import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Categoria } from '@app/core/models/categoria';
import { Producto } from '@app/core/models/producto';
import { environment } from '../../../../environments/environment';
//import { Observable } from 'rxjs/internal/Observable';
//import { map } from 'rxjs/internal/operators/map';
import { Observable, concat, map, of } from 'rxjs';

export interface CartItem {
  id: number;
  producto: Producto;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  orden_detalle_id?: number;
  modificadores?: CartItemModificador[];
  nota?: string;
  isModifierVariant?: boolean;
  requiresModifierSelection?: boolean;
  parentItemId?: number;
}

export interface CartItemModificador {
  modificador_id: number;
  opcion_id: number;
  opcion_nombre: string;
  precio_extra: number;
}

export interface Mesa {
  id: number;
  numero: string;
  capacidad: number;
  estado: 'libre' | 'ocupada' | 'reservada' | 'mantenimiento';
  posicion_x?: number | null;
  posicion_y?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClienteSearch {
  id: number;
  nombre: string;
  telefono?: string;
}

export interface Order {
  id: number;
  numero_orden?: string;
  cliente_nombre?: string | null;
  cliente_telefono?: string | null;
  cliente_id?: number | null;
  tipo_orden?: 'dine-in' | 'to-go' | 'delivery';
  mesa_id?: number | null;
  mesa?: Mesa;
  fecha_orden?: string | null;
  fecha_programada?: string | null;
  tipo_flujo?: 'normal' | 'preorden';
  estado_preorden?: 'programada' | 'activada' | 'cancelada' | null;
  estado_solicitud?: 'pendiente' | 'aceptada' | 'rechazada' | 'vencida' | null;
  preorden_activada_en?: string | null;
  items: CartItem[];
  subtotal: number;
  impuesto?: number;
  descuento?: number;
  total: number;
  metodo_pago?: 'efectivo' | 'qr';
  montoRecibido?: number;
  estado?: string;
  estado_pago?: 'pendiente' | 'parcial' | 'completado';
  pagos?: PagoOrden[];
  saldo_pendiente?: number;
  version?: number;
  reserva_sesion_id?: string;
  created_at?: string;
  ultimo_cambio_mesero_en?: string | null;
}

export interface OrderPayload {
  cliente_id?: number | null;
  cliente_nombre?: string | null;
  cliente_telefono?: string | null;
  tipo_orden?: 'dine-in' | 'to-go' | 'delivery';
  mesa_id?: number | null;
  fecha_orden?: string | null;
  fecha_programada?: string | null;
  tipo_flujo?: 'normal' | 'preorden';
  items: OrderItem[];
  subtotal: number;
  descuento?: number;
  total: number;
  observaciones?: string;
  reserva_sesion_id?: string;
}

export interface OrderItem {
  orden_detalle_id?: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  modificadores?: OrderItemModificador[];
  nota?: string | null;
}

export interface OrderItemModificador {
  modificador_opcion_id: number;
  precio_extra: number;
}

export interface PaymentMethodOption {
  id: string;
  nombre: string;
  icon?: string;
}

export interface PagoOrden {
  id: number;
  id_orden: number;
  monto_recibido: number;
  monto_pagado: number;
  cambio_devuelto: number;
  metodo_pago: 'efectivo' | 'qr';
  tipo_pago: 'devolucion' | 'pago';
  fecha_pago: string;
  created_at?: string;
  updated_at?: string;
}

export interface CancelacionInfo {
  monto_devolucion: number;
  pago_origen_id: number | null;
  caja_origen_id: number | null;
  caja_origen_estado: string | null;
  caja_actual_id: number | null;
  efectivo_disponible: number;
  faltante_efectivo: number;
}

export interface CajaResumen {
  monto_apertura: number;
  ingresos_efectivo: number;
  monto_esperado: number;
  cantidad_pagos_efectivo: number;
}

export interface Caja {
  id: number;
  user_id: number;
  monto_apertura: number;
  monto_esperado?: number | null;
  monto_cierre?: number | null;
  diferencia?: number | null;
  fecha_apertura: string;
  fecha_cierre?: string | null;
  estado: 'abierta' | 'cerrada';
  observacion_apertura?: string | null;
  observacion_cierre?: string | null;
  puede_cerrar?: boolean;
  es_compartida?: boolean;
  user?: CajaUsuario;
  usuarios?: CajaUsuario[];
}

export interface CajaUsuario {
  id: number;
  name: string;
  username?: string | null;
  estado_invitacion?: 'pendiente' | 'aceptada' | 'rechazada' | 'revocada' | 'salida' | null;
}

export interface PaginatedOrders {
  data: Order[];
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

@Injectable({
  providedIn: 'root',
})
export class PosService {
  private apiUrl = environment.apiUrl;
  private editingOrderSnapshot: Order | null = null;

  constructor(private http: HttpClient) {}

  crearOrden(order: Order, reservaSesionId?: string): Observable<any> {
    const payload = this.mapOrderToPayload(order);
    if (reservaSesionId) payload.reserva_sesion_id = reservaSesionId;
    return this.http.post<any>(`${this.apiUrl}/ordenes`, payload);
  }

  obtenerOrdenes(): Observable<Order[]> {
    return this.http.get<{ ordenes: Order[] }>(`${this.apiUrl}/ordenes`).pipe(
      map((response) => response.ordenes || [])
    );
  }

  obtenerOrdenPorId(id: number): Observable<{ orden: Order }> {
    const request = this.http.get<{ orden: Order }>(`${this.apiUrl}/ordenes/${id}`);
    const snapshot = this.editingOrderSnapshot?.id === id ? this.editingOrderSnapshot : null;
    this.editingOrderSnapshot = null;
    return snapshot ? concat(of({ orden: snapshot }), request) : request;
  }

  obtenerOrdenesPaginadas(options: {
    page: number; perPage: number; search?: string; sortKey?: string | null;
    sortDirection?: 'asc' | 'desc'; dateFrom?: string | null; dateTo?: string | null;
  }): Observable<PaginatedOrders> {
    let params = new HttpParams()
      .set('paginated', '1')
      .set('page', options.page)
      .set('per_page', options.perPage);
    if (options.search?.trim()) params = params.set('search', options.search.trim());
    if (options.sortKey) params = params.set('sort_key', options.sortKey);
    if (options.sortDirection) params = params.set('sort_direction', options.sortDirection);
    if (options.dateFrom) params = params.set('date_from', options.dateFrom);
    if (options.dateTo) params = params.set('date_to', options.dateTo);
    return this.http.get<{ ordenes: PaginatedOrders }>(`${this.apiUrl}/ordenes`, { params })
      .pipe(map(response => response.ordenes));
  }

  prepararEdicion(orden: Order): void { this.editingOrderSnapshot = orden; }

  obtenerHistorialOrden(id: number): Observable<any[]> {
    return this.http.get<{ historial: any[] }>(`${this.apiUrl}/ordenes/${id}/historial`).pipe(
      map(response => response.historial || [])
    );
  }

  actualizarOrden(id: number, data: OrderPayload, expectedVersion: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/ordenes/${id}`, { ...data, expected_version: expectedVersion });
  }

  eliminarOrden(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/ordenes/${id}`);
  }

  cancelarVenta(id: number, expectedVersion: number, metodoPago?: 'efectivo' | 'qr'): Observable<any> {
    return this.http.post(`${this.apiUrl}/ordenes/${id}/cancelar-venta`, {
      expected_version: expectedVersion,
      metodo_pago: metodoPago ?? null,
    });
  }

  obtenerInformacionCancelacion(id: number): Observable<CancelacionInfo> {
    return this.http.get<CancelacionInfo>(`${this.apiUrl}/ordenes/${id}/cancelacion-info`);
  }

  obtenerMetodosPago(): Observable<PaymentMethodOption[]> {
    return this.http.get<PaymentMethodOption[]>(`${this.apiUrl}/payment-methods`);
  }

  buscarClientes(query: string): Observable<ClienteSearch[]> {
    return this.http.get<{ clientes: ClienteSearch[] }>(`${this.apiUrl}/clientes/search?q=${query}`).pipe(
      map(res => res.clientes || [])
    );
  }

  obtenerMesas(): Observable<Mesa[]> {
    return this.http.get<{ mesas: Mesa[] }>(`${this.apiUrl}/mesas`).pipe(
      map(res => res.mesas || [])
    );
  }

  crearCliente(nombre: string, telefono?: string): Observable<ClienteSearch> {
    return this.http.post<{ cliente: ClienteSearch }>(`${this.apiUrl}/clientes`, {
      nombre,
      telefono: telefono || null
    }).pipe(
      map(res => res.cliente)
    );
  }

  obtenerPagosOrden(idOrden: number): Observable<PagoOrden[]> {
    return this.http.get<PagoOrden[]>(`${this.apiUrl}/pagos-ordenes?id_orden=${idOrden}`);
  }

  crearPagoOrden(data: {
    id_orden: number;
    monto_recibido: number;
    metodo_pago: 'efectivo' | 'qr';
    tipo_pago: 'pago' | 'devolucion';
    monto_pagado?: number;
    cambio_devuelto?: number;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/pagos-ordenes`, data);
  }

  obtenerPreordenesProgramadas(): Observable<Order[]> {
    return this.http.get<{ ordenes: Order[] }>(`${this.apiUrl}/ordenes`, {
      params: { tipo_flujo: 'preorden', estado_preorden: 'programada' },
    }).pipe(map(response => response.ordenes || []));
  }

  activarPreorden(id: number): Observable<{ message: string; orden: Order }> {
    return this.http.post<{ message: string; orden: Order }>(`${this.apiUrl}/ordenes/${id}/activar-preorden`, {});
  }

  obtenerCajaActual(): Observable<{ caja: Caja | null; resumen?: CajaResumen }> {
    return this.http.get<{ caja: Caja | null; resumen?: CajaResumen }>(`${this.apiUrl}/cajas/actual`);
  }

  abrirCaja(data: { monto_apertura: number; observacion_apertura?: string }): Observable<{ caja: Caja }> {
    return this.http.post<{ caja: Caja }>(`${this.apiUrl}/cajas/abrir`, data);
  }

  cerrarCaja(id: number, data: { monto_cierre: number; observacion_cierre?: string }): Observable<{ caja: Caja; resumen: CajaResumen }> {
    return this.http.post<{ caja: Caja; resumen: CajaResumen }>(`${this.apiUrl}/cajas/${id}/cerrar`, data);
  }

  obtenerUsuariosDisponiblesCaja(id: number): Observable<{ usuarios: CajaUsuario[] }> {
    return this.http.get<{ usuarios: CajaUsuario[] }>(`${this.apiUrl}/cajas/${id}/usuarios-disponibles`);
  }

  actualizarUsuariosCaja(id: number, usuarios: number[]): Observable<{ caja: Caja }> {
    return this.http.put<{ caja: Caja }>(`${this.apiUrl}/cajas/${id}/usuarios`, { usuarios });
  }

  obtenerInvitacionCaja(): Observable<{ invitacion: Caja | null }> {
    return this.http.get<{ invitacion: Caja | null }>(`${this.apiUrl}/cajas/invitacion-pendiente`);
  }

  responderInvitacionCaja(id: number, respuesta: 'aceptar' | 'rechazar'): Observable<{ message: string; caja?: Caja }> {
    return this.http.post<{ message: string; caja?: Caja }>(`${this.apiUrl}/cajas/${id}/invitacion/${respuesta}`, {});
  }

  salirCajaCompartida(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/cajas/${id}/salir`);
  }

  registrarGastoCaja(data: { categoria: string; concepto?: string | null; monto: number }): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/gastos-caja`, data);
  }

  registrarMovimientoCaja(data: { tipo: 'INGRESO' | 'RETIRO'; monto: number; motivo?: string | null }): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/movimientos-caja`, data);
  }

  /**
   * Mapea un Order (del frontend) a OrderPayload (para el backend)
   */
  public mapOrderToPayload(order: Order): OrderPayload {
    console.log('Mapping order to payload:', order);
    return {
      cliente_id: order.cliente_id || null,
      cliente_nombre: order.cliente_nombre || null,
      cliente_telefono: order.cliente_telefono || null,
      mesa_id: order.mesa_id || null,
      tipo_orden: order.tipo_orden || 'dine-in',
      fecha_orden: this.normalizeDateTimeString(order.fecha_orden) ?? this.getNowDateTimeString(),
      fecha_programada: this.normalizeDateTimeString(order.fecha_programada) ?? null,
      tipo_flujo: order.tipo_flujo ?? (order.fecha_programada ? 'preorden' : 'normal'),
      subtotal: order.subtotal,
      descuento: order.descuento || 0,
      total: order.total,
      observaciones: order.cliente_nombre ? `Cliente: ${order.cliente_nombre}` : undefined,
      reserva_sesion_id: order.reserva_sesion_id,
      items: order.items.map(item => ({
        // Conserva el identificador al editar: el backend compara este detalle
        // con el existente en vez de borrar y crear toda la orden nuevamente.
        orden_detalle_id: item.orden_detalle_id,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        nota: item.nota?.trim() || null,
        modificadores: (item.modificadores || []).map(mod => ({
          modificador_opcion_id: mod.opcion_id,
          precio_extra: mod.precio_extra,
        })),
      })),
    };
  }

  private getTodayDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getNowDateTimeString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  private normalizeDateTimeString(value?: string | null): string | null {
    if (!value || !value.trim()) {
      return null;
    }

    const normalized = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return `${normalized}T00:00:00`;
    }

    if (/^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}$/.test(normalized)) {
      return `${normalized.replace(' ', 'T')}:00`;
    }

    if (/^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}:\d{2}$/.test(normalized)) {
      return normalized.replace(' ', 'T');
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{1,2}:\d{2}(?::\d{2})?$/.test(normalized)) {
      return normalized.split(':').length === 2 ? `${normalized}:00` : normalized;
    }

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      const hours = String(parsed.getHours()).padStart(2, '0');
      const minutes = String(parsed.getMinutes()).padStart(2, '0');
      const seconds = String(parsed.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    }

    return null;
  }
}

