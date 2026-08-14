import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface MovimientoCaja {
  id: number;
  caja_id: number;
  tipo: 'INGRESO' | 'RETIRO';
  monto: number;
  motivo: string;
  estado: 'ACTIVO' | 'ANULADO';
  created_at: string;
  usuario: { id: number; name: string; username: string };
  anulador?: { id: number; name: string; username: string } | null;
  anulado_en?: string | null;
  motivo_anulacion?: string | null;
}

export type CrearMovimiento = Pick<MovimientoCaja, 'tipo' | 'monto' | 'motivo'>;

@Injectable({
  providedIn: 'root',
})
export class MovimientoService {
  private apiUrl = `${environment.apiUrl}/movimientos-caja`;

  constructor(private http: HttpClient) {}

  listar(): Observable<MovimientoCaja[]> {
    return this.http.get<{ movimientos: MovimientoCaja[] }>(this.apiUrl)
      .pipe(map(response => response.movimientos ?? []));
  }

  crear(data: CrearMovimiento): Observable<MovimientoCaja> {
    return this.http.post<{ movimiento: MovimientoCaja }>(this.apiUrl, data)
      .pipe(map(response => response.movimiento));
  }

  anular(id: number, motivo_anulacion: string): Observable<MovimientoCaja> {
    return this.http.post<{ movimiento: MovimientoCaja }>(`${this.apiUrl}/${id}/anular`, { motivo_anulacion })
      .pipe(map(response => response.movimiento));
  }
}
