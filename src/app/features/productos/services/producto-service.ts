import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { Producto, CreateProducto, UpdateProducto } from '../../../core/models/producto';

@Injectable({
  providedIn: 'root',
})
export class ProductoService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listarProductos(categoriaId?: number): Observable<Producto[]> {
    let params = new HttpParams();

    if (categoriaId !== undefined) {
      params = params.set('categoria_id', categoriaId.toString());
    }

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
}

