import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface DashboardData {
  periodo: { desde: string; hasta: string };
  kpis: {
    venta_total: number; qr: number; efectivo: number; cantidad_ordenes: number; ticket_promedio: number;
    cantidad_pagos_qr: number; porcentaje_qr: number; variacion_venta: number | null;
    cobros_efectivo: number; devoluciones_efectivo: number; cobros_qr: number; devoluciones_qr: number;
    devoluciones_total: number; monto_apertura: number; ingresos_caja: number; retiros_caja: number;
    gastos_caja: number; efectivo_esperado: number;
  };
  operacion: { ordenes_pendientes: number; cocina_pendientes: number; parrilla_pendientes: number; servicio_pendientes: number; preordenes_programadas: number };
  productos_por_agotar: Array<{ id: number; nombre: string; stock: number; stock_minimo: number; imagen_url?: string | null }>;
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
