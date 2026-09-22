import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { EstacionTrabajo } from '../../../core/models/estacion-trabajo';
import { resolveApiAssetUrl } from '../../../core/utils/asset-url';

export interface ModificadorOpcion {
  id?: number;
  nombre: string;
  precio_extra: number;
  activo?: boolean;
  maneja_stock?: boolean;
  stock?: number | null;
  stock_minimo?: number | null;
  imagen?: File | null;
  imagen_url?: string | null;
  mostrar_imagen?: boolean;
  eliminar_imagen?: boolean;
}

export interface Modificador {
  id: number;
  nombre: string;
  color_fondo?: string | null;
  tipo: 'unico' | 'multiple';
  requerido: boolean;
  activo: boolean;
  estacion_id?: number | null;
  estacion?: Pick<EstacionTrabajo, 'id' | 'nombre' | 'codigo' | 'activa'> | null;
  opciones_count?: number;
  opciones?: ModificadorOpcion[];
  created_at?: string;
}

export interface CreateModificador {
  nombre: string;
  color_fondo?: string | null;
  tipo: 'unico' | 'multiple';
  requerido: boolean;
  activo: boolean;
  estacion_id: number | null;
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
        map(res => (Array.isArray(res) ? res : (res.modificadores ?? [])).map(modificador => this.resolveImages(modificador)))
      );
  }

  obtenerModificador(id: number): Observable<Modificador> {
  return this.http
    .get<{ modificador: Modificador }>(
      `${this.apiUrl}/modificadores/${id}`
    )
    .pipe(
      map(res => this.resolveImages(res.modificador))
    );
}

  crearModificador(data: CreateModificador): Observable<{ modificadores: Modificador }> {
    return this.http.post<{ modificadores: Modificador }>(`${this.apiUrl}/modificadores`, this.toFormData(data));
  }

  actualizarModificador(id: number, data: UpdateModificador): Observable<{ modificadores: Modificador }> {
    const formData = this.toFormData(data);
    formData.append('_method', 'PUT');
    return this.http.post<{ modificadores: Modificador }>(`${this.apiUrl}/modificadores/${id}`, formData);
  }

  eliminarModificador(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/modificadores/${id}`);
  }

  private toFormData(data: CreateModificador): FormData {
    const formData = new FormData();
    formData.append('nombre', data.nombre);
    if (data.color_fondo) formData.append('color_fondo', data.color_fondo);
    formData.append('tipo', data.tipo);
    formData.append('requerido', data.requerido ? '1' : '0');
    formData.append('activo', data.activo ? '1' : '0');
    formData.append('estacion_id', data.estacion_id == null ? '' : String(data.estacion_id));
    data.opciones.forEach((opcion, index) => {
      const prefix = `opciones[${index}]`;
      if (opcion.id != null) formData.append(`${prefix}[id]`, String(opcion.id));
      formData.append(`${prefix}[nombre]`, opcion.nombre);
      formData.append(`${prefix}[precio_extra]`, String(opcion.precio_extra));
      formData.append(`${prefix}[activo]`, opcion.activo === false ? '0' : '1');
      formData.append(`${prefix}[maneja_stock]`, opcion.maneja_stock ? '1' : '0');
      formData.append(`${prefix}[mostrar_imagen]`, opcion.mostrar_imagen ? '1' : '0');
      if (opcion.stock != null) formData.append(`${prefix}[stock]`, String(opcion.stock));
      if (opcion.stock_minimo != null) formData.append(`${prefix}[stock_minimo]`, String(opcion.stock_minimo));
      if (opcion.imagen instanceof File) formData.append(`${prefix}[imagen]`, opcion.imagen);
      if (opcion.eliminar_imagen) formData.append(`${prefix}[eliminar_imagen]`, '1');
    });
    return formData;
  }

  private resolveImages(modificador: Modificador): Modificador {
    return {
      ...modificador,
      opciones: (modificador.opciones ?? []).map(opcion => ({
        ...opcion,
        imagen_url: resolveApiAssetUrl(opcion.imagen_url),
      })),
    };
  }
}
