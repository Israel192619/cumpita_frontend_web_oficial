import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface ModificadorOpcion {
  id?: number;
  nombre: string;
  precio_extra: number;
  activo?: boolean;
}

export interface Modificador {
  id: number;
  nombre: string;
  tipo: 'unico' | 'multiple';
  requerido: boolean;
  activo: boolean;
  opciones_count?: number;
  opciones?: ModificadorOpcion[];
  created_at?: string;
}

export interface CreateModificador {
  nombre: string;
  tipo: 'unico' | 'multiple';
  requerido: boolean;
  activo: boolean;
  opciones: ModificadorOpcion[];
}

export interface UpdateModificador extends CreateModificador {}

@Injectable({
  providedIn: 'root',
})
export class ModificadorService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listarModificadores(): Observable<Modificador[]> {
    return this.http.get<{ modificadores?: Modificador[] }>(`${this.apiUrl}/modificadores`)
      .pipe(
        map(res => Array.isArray(res) ? res : (res.modificadores ?? []))
      );
  }

  obtenerModificador(id: number): Observable<Modificador> {
  return this.http
    .get<{ modificador: Modificador }>(
      `${this.apiUrl}/modificadores/${id}`
    )
    .pipe(
      map(res => res.modificador)
    );
}

  crearModificador(data: CreateModificador): Observable<{ modificadores: Modificador }> {
    return this.http.post<{ modificadores: Modificador }>(`${this.apiUrl}/modificadores`, data);
  }

  actualizarModificador(id: number, data: UpdateModificador): Observable<{ modificadores: Modificador }> {
    return this.http.put<{ modificadores: Modificador }>(`${this.apiUrl}/modificadores/${id}`, data);
  }

  eliminarModificador(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/modificadores/${id}`);
  }
}
