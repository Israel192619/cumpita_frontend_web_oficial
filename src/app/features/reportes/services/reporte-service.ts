import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ReporteService {
  private readonly base = `${environment.apiUrl}/reportes`;
  constructor(private http: HttpClient) {}
  obtener(tipo: 'ventas' | 'productos' | 'caja', filtros: Record<string, string | number | null>) {
    let params = new HttpParams();
    Object.entries(filtros).forEach(([key, value]) => { if (value !== null && value !== '') params = params.set(key, String(value)); });
    return this.http.get<any>(`${this.base}/${tipo}`, { params });
  }
}
