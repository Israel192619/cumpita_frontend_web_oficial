import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';

export interface KdsCategoria {
  id: number;
  nombre: string;
}

export interface KdsProducto {
  id: number;
  nombre: string;
  categoria?: KdsCategoria | null;
}

export interface KdsEstacion {
  id: number;
  nombre: string;
  codigo: string;
}

export interface KdsDetalle {
  id: number;
  cantidad: number;
  nota?: string | null;
  estado_cocina: 'pendiente' | 'servido';
  producto: KdsProducto;
  estacion_id?: number | null;
  estacion?: KdsEstacion | null;
}

export interface KdsCambioOrden {
  id: number;
  tipo_cambio: 'detalle_agregado' | 'detalle_modificado' | 'detalle_eliminado' | 'estado_cambiado' | 'orden_cancelada';
  cantidad_anterior?: number | null;
  cantidad_nueva?: number | null;
  datos_anterior?: { producto_id?: number; producto_nombre?: string | null; cantidad?: number; nota?: string | null } | null;
  datos_nuevo?: { producto_id?: number; producto_nombre?: string | null; cantidad?: number; nota?: string | null } | null;
  producto?: { id: number; nombre: string } | null;
}

export interface KdsOrden {
  id: number;
  numero_orden: number;
  created_at: string;
  fecha_orden?: string | null;
  tipo_orden: 'dine-in' | 'to-go' | 'delivery';
  estado: string;
  cliente?: { id: number; nombre: string } | null;
  mesa?: { id: number; numero: string } | null;
  detalles: KdsDetalle[];
  cambios_recientes?: KdsCambioOrden[];
}

export interface ActualizacionEstadoCocinaResponse {
  detalle: KdsDetalle;
  orden_estado: string;
  orden_id: number;
}

@Injectable({
  providedIn: 'root',
})
export class CocinaService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  obtenerPedidos(fecha: string): Observable<{ ordenes: KdsOrden[] }> {
    return this.http.get<{ ordenes: KdsOrden[] }>(`${this.apiUrl}/cocina/pedidos`, { params: { fecha } });
  }

  actualizarEstadoDetalle(id: number, estado_cocina: 'pendiente' | 'servido'): Observable<ActualizacionEstadoCocinaResponse> {
    return this.http.patch<ActualizacionEstadoCocinaResponse>(`${this.apiUrl}/cocina/detalles/${id}`, { estado_cocina });
  }
}
