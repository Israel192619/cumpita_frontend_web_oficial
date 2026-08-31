import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface ServicioDetalle { id: number; cantidad: number; producto: string; nota?: string | null; opciones: string[]; listo: boolean; }
export interface ServicioFicha { id: number; numero_orden: number; mesa?: string | null; cliente?: string | null; mesero?: string | null; tipo_orden: 'dine-in' | 'to-go' | 'delivery'; hora: string; tiempo_espera_minutos: number; detalles: ServicioDetalle[]; listos: number; total_items: number; todo_listo: boolean; created_at: string; fecha_programada?: string | null; estado_preorden?: string | null; bloqueada?: boolean; }
export interface ServicioSesion { session_id: string; token?: string; expires_at: number; user: { id: number; name: string }; principal?: boolean; }
export interface ServicioTablero { disponibles: ServicioFicha[]; mis_fichas: ServicioFicha[]; preordenes_programadas?: ServicioFicha[]; }
export interface OrdenServicioResumen { id: number; numero_orden: number; mesa?: string | null; cliente?: string | null; tipo_orden: string; estado: string; puede_agregar: boolean; }
export interface OrdenServicioDetalle extends OrdenServicioResumen { subtotal: number; total: number; saldo_pendiente: number; detalles: ServicioDetalle[]; }

@Injectable({ providedIn: 'root' })
export class ServicioService {
  private readonly api = `${environment.apiUrl}/servicio`;
  private readonly storageKey = 'servicio_sesiones';

  constructor(private http: HttpClient) {}

  listar(token?: string, fecha?: string): Observable<ServicioTablero> {
    return this.http.get<ServicioTablero>(`${this.api}/fichas`, {
      ...this.opciones(token),
      params: fecha ? { fecha } : undefined,
    });
  }
  tomar(id: number, token?: string) { return this.http.post(`${this.api}/fichas/${id}/tomar`, {}, this.opciones(token)); }
  liberar(id: number, token?: string) { return this.http.post(`${this.api}/fichas/${id}/liberar`, {}, this.opciones(token)); }
  confirmar(detalleId: number, token?: string) { return this.http.patch(`${this.api}/detalles/${detalleId}/confirmar`, {}, this.opciones(token)); }
  entregar(id: number, token?: string) { return this.http.post(`${this.api}/fichas/${id}/entregar`, {}, this.opciones(token)); }
  cerrarSesion(token?: string, liberarFichas = false) { return this.http.post(`${this.api}/sesion/cerrar`, { liberar_fichas: liberarFichas }, this.opciones(token)); }
  buscarOrdenes(q: string, token?: string) { return this.http.get<{ ordenes: OrdenServicioResumen[] }>(`${this.api}/ordenes/buscar`, { ...this.opciones(token), params: { q } }); }
  obtenerOrden(id: number, token?: string) { return this.http.get<{ orden: OrdenServicioDetalle }>(`${this.api}/ordenes/${id}`, this.opciones(token)); }
  agregarAdicional(id: number, data: { producto_id: number; cantidad: number; nota?: string | null; modificador_opcion_ids: number[] }, token?: string) {
    return this.http.post<{ message: string; orden: OrdenServicioDetalle }>(`${this.api}/ordenes/${id}/adicionales`, data, this.opciones(token));
  }

  sesionesGuardadas(): ServicioSesion[] {
    const ahora = Date.now();
    try {
      const sesiones = JSON.parse(localStorage.getItem(this.storageKey) ?? '[]') as ServicioSesion[];
      const vigentes = sesiones.filter(sesion => sesion.token && sesion.expires_at > ahora);
      if (vigentes.length !== sesiones.length) this.guardarSesiones(vigentes);
      return vigentes;
    } catch {
      this.guardarSesiones([]);
      return [];
    }
  }
  agregarSesion(sesion: ServicioSesion): ServicioSesion[] {
    const sesiones = this.sesionesGuardadas().filter(item => item.session_id !== sesion.session_id);
    sesiones.push(sesion);
    this.guardarSesiones(sesiones);
    return sesiones;
  }
  quitarSesion(sessionId: string): ServicioSesion[] {
    const sesiones = this.sesionesGuardadas().filter(item => item.session_id !== sessionId);
    this.guardarSesiones(sesiones);
    return sesiones;
  }
  private guardarSesiones(sesiones: ServicioSesion[]): void { localStorage.setItem(this.storageKey, JSON.stringify(sesiones)); }
  private headers(token: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}`, 'X-Service-Session': '1', 'X-Service-Request': '1' });
  }
  private opciones(token?: string): { headers: HttpHeaders } {
    return {
      headers: token
        ? this.headers(token)
        : new HttpHeaders({ 'X-Service-Request': '1' })
    };
  }
}
