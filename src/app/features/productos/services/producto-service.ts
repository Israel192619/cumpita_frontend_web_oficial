import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { Producto, CreateProducto, UpdateProducto } from '../../../core/models/producto';

export type TipoAjusteStock = 'ENTRADA' | 'SALIDA' | 'CORRECCION';
export interface AjusteStock {
  id: number;
  tipo: TipoAjusteStock;
  cantidad: number;
  stock_anterior: number;
  stock_final: number;
  motivo: string;
  revertido_por_ajuste_id?: number | null;
  created_at: string;
  producto: Pick<Producto, 'id' | 'nombre'>;
  usuario: { id: number; name: string; username?: string };
}

@Injectable({
  providedIn: 'root',
})
export class ProductoService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listarProductos(categoriaId?: number, reservaSesion?: string): Observable<Producto[]> {
    let params = new HttpParams();

    if (categoriaId !== undefined) {
      params = params.set('categoria_id', categoriaId.toString());
    }
    if (reservaSesion) params = params.set('reserva_sesion', reservaSesion);

    return this.http
      .get<{ productos: Producto[] }>(
        `${this.apiUrl}/productos`,
        { params }
      )
      .pipe(
        map(res => res.productos ?? [])
      );
  }

  obtenerProducto(id: number): Observable<Producto> {
    return this.http.get<{ producto: Producto }>(`${this.apiUrl}/productos/${id}`)
      .pipe(
        map(res => res.producto)
      );
  }

  crearProducto(data: FormData): Observable<{ producto: Producto }> {
    return this.http.post<{ producto: Producto }>(`${this.apiUrl}/productos`, data);
  }

  actualizarProducto(id: number, data: FormData): Observable<{ producto: Producto }> {
    return this.http.post<{ producto: Producto }>(`${this.apiUrl}/productos/${id}`, data);
  }

  eliminarProducto(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/productos/${id}`);
  }

  ajustarStock(id: number, cantidad: number): Observable<{ producto: Producto }> {
    return this.http.post<{ producto: Producto }>(`${this.apiUrl}/productos/${id}/stock-adjust`, { cantidad });
  }

  listarAjustesStock(): Observable<AjusteStock[]> {
    return this.http.get<{ ajustes: AjusteStock[] }>(`${this.apiUrl}/ajustes-stock`)
      .pipe(map(response => response.ajustes ?? []));
  }

  crearAjusteStock(data: { producto_id: number; tipo: TipoAjusteStock; cantidad: number; motivo: string }): Observable<AjusteStock> {
    return this.http.post<{ ajuste: AjusteStock }>(`${this.apiUrl}/ajustes-stock`, data)
      .pipe(map(response => response.ajuste));
  }

  revertirAjusteStock(id: number): Observable<AjusteStock> {
    return this.http.post<{ ajuste: AjusteStock }>(`${this.apiUrl}/ajustes-stock/${id}/revertir`, {})
      .pipe(map(response => response.ajuste));
  }

  sincronizarReservasStock(sesionId: string, items: Array<{ producto_id: number; cantidad: number }>) {
    return this.http.post<{ expira_en: string }>(`${this.apiUrl}/reservas-stock/sincronizar`, { sesion_id: sesionId, items });
  }

  liberarReservasStock(sesionId: string) {
    return this.http.delete<void>(`${this.apiUrl}/reservas-stock`, { body: { sesion_id: sesionId } });
  }
}

