import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { EstacionTrabajo, EstacionTrabajoPayload } from '../../../core/models/estacion-trabajo';

@Injectable({ providedIn: 'root' })
export class EstacionTrabajoService {
  private readonly apiUrl = `${environment.apiUrl}/estaciones-trabajo`;

  constructor(private http: HttpClient) {}

  listar(): Observable<EstacionTrabajo[]> {
    return this.http.get<{ estaciones: EstacionTrabajo[] }>(this.apiUrl)
      .pipe(map(res => res.estaciones ?? []));
  }

  crear(data: EstacionTrabajoPayload): Observable<{ estacion: EstacionTrabajo }> {
    return this.http.post<{ estacion: EstacionTrabajo }>(this.apiUrl, data);
  }

  actualizar(id: number, data: EstacionTrabajoPayload): Observable<{ estacion: EstacionTrabajo }> {
    return this.http.put<{ estacion: EstacionTrabajo }>(`${this.apiUrl}/${id}`, data);
  }
}
