import { Injectable } from '@angular/core';
import { CreateMesa, UpdateMesa, Mesa } from '../../../core/models/mesa';
import { Observable } from 'rxjs/internal/Observable';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { map } from 'rxjs/internal/operators/map';

@Injectable({
  providedIn: 'root',
})
export class MesaService {
  private apiUrl = environment.apiUrl;
  
  constructor(private http: HttpClient) { }

  listarMesas(): Observable<Mesa[]> {
    return this.http.get<{ mesas: Mesa[] }>(`${this.apiUrl}/mesas`)
      .pipe(
        map(res => res.mesas ?? [])
      );
  }

  getMesaPorId(id: number): Observable<Mesa> {
    return this.http.get<{ mesa: Mesa }>(`${this.apiUrl}/mesas/${id}`)
      .pipe(
        map(res => res.mesa)
      );
  }

  crearMesa(mesa: CreateMesa): Observable<Mesa> {
    return this.http.post<{ mesa: Mesa }>(`${this.apiUrl}/mesas`, mesa)
      .pipe(
        map(res => res.mesa)
      );
  }

  editarMesa(id: number, mesa: UpdateMesa): Observable<Mesa> {
    return this.http.put<{ mesa: Mesa }>(`${this.apiUrl}/mesas/${id}`, mesa)
      .pipe(
        map(res => res.mesa)
      );
  }

  eliminarMesa(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/mesas/${id}`);
  }
}
