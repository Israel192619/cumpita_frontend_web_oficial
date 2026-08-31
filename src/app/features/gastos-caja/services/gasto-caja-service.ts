import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';

export const CATEGORIAS_GASTO = [
  'INSUMOS', 'LIMPIEZA', 'GAS', 'CARBON', 'TRANSPORTE',
  'MANTENIMIENTO', 'SERVICIOS', 'PERSONAL', 'OTROS',
] as const;

export type CategoriaGasto = typeof CATEGORIAS_GASTO[number];

export interface GastoCaja {
  id: number;
  caja_id: number;
  categoria: CategoriaGasto;
  concepto?: string | null;
  monto: number;
  estado: 'ACTIVO' | 'ANULADO';
  created_at: string;
  usuario: { id: number; name: string; username: string };
  anulador?: { id: number; name: string; username: string } | null;
  anulado_en?: string | null;
  motivo_anulacion?: string | null;
}

export interface CrearGasto {
  categoria: CategoriaGasto;
  concepto?: string | null;
  monto: number;
}

@Injectable({ providedIn: 'root' })
export class GastoCajaService {
  private apiUrl = `${environment.apiUrl}/gastos-caja`;

  constructor(private http: HttpClient) {}

  listar(): Observable<GastoCaja[]> {
    return this.http.get<{ gastos: GastoCaja[] }>(this.apiUrl)
      .pipe(map(response => response.gastos ?? []));
  }

  crear(data: CrearGasto): Observable<GastoCaja> {
    return this.http.post<{ gasto: GastoCaja }>(this.apiUrl, data)
      .pipe(map(response => response.gasto));
  }

  anular(id: number, motivo_anulacion: string): Observable<GastoCaja> {
    return this.http.post<{ gasto: GastoCaja }>(`${this.apiUrl}/${id}/anular`, { motivo_anulacion })
      .pipe(map(response => response.gasto));
  }
}
