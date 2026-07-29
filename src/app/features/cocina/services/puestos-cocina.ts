import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { User } from '@app/core/models/user';
import { KdsOrden } from './cocina-service';

export interface PuestoCocina {
  id: number;
  estacion_id: number;
  nombre: string;
  user_id?: number | null;
  user_nombre?: string | null;
  orden_id?: number | null;
  orden_numero?: number | null;
  orden_estado_cocina?: string | null;
  usuario?: { id: number; name: string } | null;
  orden?: KdsOrden | null;
}

export interface CocinaControlResponse {
  // Backwards-compatible: backend may return either shape
  usuario?: User;
  puesto?: PuestoCocina | null;
  puesto_actual?: PuestoCocina | null;
  estado?: string;
  puestos?: PuestoCocina[];
  ordenes_disponibles?: KdsOrden[];
  pedidos_disponibles?: KdsOrden[];
}

@Injectable({
  providedIn: 'root',
})
export class PuestosCocinaService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  obtenerPuestos(): Observable<{ puestos: PuestoCocina[] }> {
    return this.http.get<{ puestos: PuestoCocina[] }>(`${this.apiUrl}/cocina/monitor/puestos`);
  }

  ocuparPuesto(id: number): Observable<{ puesto: PuestoCocina }> {
    return this.http.post<{ puesto: PuestoCocina }>(`${this.apiUrl}/cocina/control/puestos/${id}/ocupar`, {});
  }

  liberarPuesto(id: number): Observable<{ puesto: PuestoCocina }> {
    return this.http.post<{ puesto: PuestoCocina }>(`${this.apiUrl}/cocina/control/puestos/${id}/liberar`, {});
  }

  asignarOrden(id: number, ordenId: number): Observable<{ puesto: PuestoCocina }> {
    return this.http.post<{ puesto: PuestoCocina }>(`${this.apiUrl}/cocina/control/puestos/${id}/asignar-orden`, { orden_id: ordenId });
  }

  liberarOrden(id: number): Observable<{ puesto: PuestoCocina }> {
    return this.http.post<{ puesto: PuestoCocina }>(`${this.apiUrl}/cocina/control/puestos/${id}/liberar-orden`, {});
  }

  marcarOrdenLista(id: number): Observable<{ puesto: PuestoCocina; orden: any }> {
    return this.http.post<{ puesto: PuestoCocina; orden: any }>(`${this.apiUrl}/cocina/control/puestos/${id}/orden/lista`, {});
  }

  obtenerControlPuesto(): Observable<CocinaControlResponse> {
    return this.http.get<CocinaControlResponse>(`${this.apiUrl}/cocina/control`);
  }
}
