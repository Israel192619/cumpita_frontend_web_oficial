import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReverbService } from './reverb-service';
import { environment } from '../../../environments/environment';

export interface UbicacionRestaurante { latitud: number; longitud: number; }
interface Configuracion { pos: { editar_fecha_trabajo: boolean }; restaurante: UbicacionRestaurante | null; }

@Injectable({ providedIn: 'root' })
export class ConfiguracionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/configuracion`;
  readonly permiteFechaTrabajo = signal(false);
  readonly ubicacionRestaurante = signal<UbicacionRestaurante | null>(null);
  constructor() {
    inject(ReverbService).escucharCanal('canal-configuracion', '.ConfiguracionActualizada').pipe(
      switchMap(() => this.cargar().pipe(catchError(() => EMPTY))),
      takeUntilDestroyed()
    ).subscribe();
  }
  cargar() {
    return this.http.get<Configuracion>(this.url).pipe(tap(data => {
      this.permiteFechaTrabajo.set(data.pos.editar_fecha_trabajo);
      this.ubicacionRestaurante.set(data.restaurante);
    }));
  }
  guardarFechaTrabajo(value: boolean) {
    return this.http.put<Configuracion>(this.url, { pos: { editar_fecha_trabajo: value } })
      .pipe(tap(data => this.permiteFechaTrabajo.set(data.pos.editar_fecha_trabajo)));
  }
  guardarUbicacionRestaurante(value: UbicacionRestaurante) {
    return this.http.put<Configuracion>(this.url, { restaurante: value })
      .pipe(tap(data => this.ubicacionRestaurante.set(data.restaurante)));
  }
}
