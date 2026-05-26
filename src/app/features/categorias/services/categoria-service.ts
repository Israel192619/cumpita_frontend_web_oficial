import { Injectable } from '@angular/core';
import { CreateCategoria, UpdateCategoria, Categoria } from '../../../core/models/categoria';
import { Observable } from 'rxjs/internal/Observable';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { map } from 'rxjs/internal/operators/map';

@Injectable({
  providedIn: 'root',
})
export class CategoriaService {
  private apiUrl = environment.apiUrl;
  constructor(private http: HttpClient) { }

  listarCategorias(): Observable<Categoria[]> {
    return this.http.get<{ categorias: Categoria[] }>(`${this.apiUrl}/categorias`)
      .pipe(
        map(res => res.categorias ?? [])
      );
  }

  getCategoriasPadre(): Observable<Categoria[]> {
    return this.listarCategorias().pipe(
      map(categorias => categorias.filter(c => !c.parent_id))
    );
  }

  eliminarCategoria(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/categorias/${id}`);
  }

  crearCategoria(data: CreateCategoria): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/categorias`, data);
  }

  editarCategoria(id: number, categoria: UpdateCategoria): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/categorias/${id}`, categoria);
  }

  getCategoriaPorId(id: number): Observable<Categoria> {
    return this.http.get<{ categoria: Categoria }>(`${this.apiUrl}/categorias/${id}`)
      .pipe(
        map(res => res.categoria)
      );
  }
}
