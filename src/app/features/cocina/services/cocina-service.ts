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
  precio_unitario?: number | string;
  nota?: string | null;
  // Expanded states for the detail lifecycle. UI will remain backwards-compatible.
  estado_cocina: 'pendiente' | 'en_preparacion' | 'listo_para_recoger' | 'recogido' | 'servido';
  producto: KdsProducto;
  estacion_id?: number | null;
  estacion?: KdsEstacion | null;
  estado_estacion_id?: number;
  incluye_producto?: boolean;
  opciones?: KdsDetalleOpcion[];
}

export interface KdsDetalleOpcion {
  id: number;
  modificador_opcion?: {
    id: number;
    nombre: string;
    modificador?: { id: number; nombre: string; estacion_id?: number | null } | null;
  } | null;
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

export interface KdsPedidosResponse {
  ordenes: KdsOrden[];
  estacion: KdsEstacion;
  estaciones_disponibles: KdsEstacion[];
}

@Injectable({
  providedIn: 'root',
})
export class CocinaService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  obtenerPedidos(fecha: string, estacion?: string | number | null): Observable<KdsPedidosResponse> {
    const params: Record<string, string> = { fecha };
    if (estacion !== null && estacion !== undefined) params['estacion'] = String(estacion);
    return this.http.get<KdsPedidosResponse>(`${this.apiUrl}/kds/pedidos`, { params });
  }

  actualizarEstadoDetalle(id: number, estacion_id: number, estado_cocina: 'pendiente' | 'en_preparacion' | 'listo_para_recoger' | 'recogido' | 'servido'): Observable<ActualizacionEstadoCocinaResponse> {
    return this.http.patch<ActualizacionEstadoCocinaResponse>(`${this.apiUrl}/kds/detalles/${id}`, { estacion_id, estado_cocina });
  }
}
