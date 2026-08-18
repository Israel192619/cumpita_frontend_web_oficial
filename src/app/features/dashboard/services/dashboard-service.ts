import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface DashboardData {
  periodo: { desde: string; hasta: string };
  kpis: { venta_total: number; qr: number; efectivo: number; cantidad_ordenes: number; ticket_promedio: number };
  operacion: { ordenes_pendientes: number; cocina_pendientes: number; parrilla_pendientes: number; servicio_pendientes: number; preordenes_programadas: number };
  productos_por_agotar: Array<{ id: number; nombre: string; stock: number; stock_minimo: number }>;
  productos_mas_vendidos: Array<{ id: number; nombre: string; cantidad: number }>;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly url = `${environment.apiUrl}/dashboard`;
  constructor(private http: HttpClient) {}
  obtener(desde: string, hasta: string) {
    const params = new HttpParams().set('desde', desde).set('hasta', hasta);
    return this.http.get<DashboardData>(this.url, { params });
  }
}
