import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReverbService } from './reverb-service';
import { environment } from '../../../environments/environment';

interface Configuracion { pos: { editar_fecha_trabajo: boolean }; }

@Injectable({ providedIn: 'root' })
export class ConfiguracionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/configuracion`;
  readonly permiteFechaTrabajo = signal(false);
  constructor() {
    inject(ReverbService).escucharCanal('canal-configuracion', '.ConfiguracionActualizada').pipe(
      switchMap(() => this.cargar().pipe(catchError(() => EMPTY))),
      takeUntilDestroyed()
    ).subscribe();
  }
  cargar() {
    return this.http.get<Configuracion>(this.url).pipe(tap(data => this.permiteFechaTrabajo.set(data.pos.editar_fecha_trabajo)));
  }
  guardarFechaTrabajo(value: boolean) {
    return this.http.put<Configuracion>(this.url, { pos: { editar_fecha_trabajo: value } })
      .pipe(tap(data => this.permiteFechaTrabajo.set(data.pos.editar_fecha_trabajo)));
  }
}
