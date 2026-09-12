import { Component, inject, signal } from '@angular/core';
import { ConfiguracionService } from '../../core/services/configuracion-service';
import { LocationMap, MapLocation } from '../../shared/components/location-map/location-map';

@Component({
  selector: 'app-configuracion',
  imports: [LocationMap],
  template: `
    <header><h1>Configuración</h1><p>Personaliza el funcionamiento de tu negocio.</p></header>
    <div class="settings-layout">
      <nav aria-label="Secciones de configuración"><button type="button" aria-current="page">General</button></nav>
      <div class="settings-sections"><section aria-labelledby="pos-title">
        <h2 id="pos-title">POS</h2><p>Opciones del punto de venta.</p>
        <label class="setting"><input type="checkbox" [checked]="config.permiteFechaTrabajo()" [disabled]="cargando() || guardando()" (change)="guardar($any($event.target).checked)">
          <span><strong>Edición de fecha de trabajo</strong><small>Permite elegir la fecha y hora de trabajo al crear o editar órdenes. Si está desactivado, las nuevas órdenes usan la fecha y hora del sistema y las existentes conservan su fecha original.</small></span>
        </label>
        <p class="hint">Los cambios se guardan automáticamente. La programación de preórdenes se mantiene disponible.</p>
        <p role="status" aria-live="polite">{{ estado() }}</p>
        @if (error()) { <p role="alert" class="error">{{ error() }}</p><button type="button" (click)="cargar()">Volver a cargar</button> }
      </section>
      <section aria-labelledby="restaurant-title">
        <h2 id="restaurant-title">Ubicación del restaurante</h2>
        <p>Marca el punto desde donde salen los meseros. Se usará como inicio de las rutas de delivery.</p>
        <app-location-map [editable]="true" [latitud]="restaurante()?.latitud ?? null" [longitud]="restaurante()?.longitud ?? null" (locationChange)="seleccionarRestaurante($event)" />
        <div class="save-location"><button type="button" [disabled]="!restaurante() || guardandoUbicacion()" (click)="guardarRestaurante()">{{ guardandoUbicacion() ? 'Guardando…' : 'Guardar ubicación del restaurante' }}</button></div>
      </section></div>
    </div>`,
  styles: [`:host{display:block;padding:clamp(16px,3vw,32px);color:var(--color-text)}h1{margin:0;font-size:1.7rem}header p,section>p{color:var(--color-text-secondary)}.settings-layout{display:grid;grid-template-columns:200px minmax(0,1fr);gap:24px;margin-top:24px}.settings-sections{display:grid;gap:18px}nav,section{background:var(--color-surface);border:1px solid var(--color-border);border-radius:12px;padding:20px}nav{align-self:start;padding:8px}button{font:inherit;cursor:pointer;padding:12px;border-radius:8px;border:1px solid var(--color-border);background:var(--color-surface);color:var(--color-text)}button:disabled{opacity:.55;cursor:default}nav button{width:100%;text-align:left;background:var(--color-primary);color:var(--color-on-primary,#fff);font-weight:700}h2{margin-top:0}.setting{display:flex;gap:14px;align-items:flex-start;padding:20px 0;border-top:1px solid var(--color-border);cursor:pointer}.setting input{width:22px;height:22px;flex-shrink:0;accent-color:var(--color-primary)}small{display:block;line-height:1.6;margin-top:8px;color:var(--color-text-secondary);max-width:680px}.hint{font-size:.85rem}.error{color:var(--color-danger)}.save-location{display:flex;justify-content:flex-end;margin-top:14px}.save-location button{border-color:var(--color-primary);background:var(--color-primary);color:var(--color-on-primary,#fff);font-weight:700}@media(max-width:700px){.settings-layout{grid-template-columns:1fr;gap:12px}}`]
})
export class Configuracion {
  readonly config = inject(ConfiguracionService);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly estado = signal('Cargando configuración…');
  readonly error = signal('');
  readonly restaurante = signal<MapLocation | null>(null);
  readonly guardandoUbicacion = signal(false);
  constructor() { this.cargar(); }
  cargar() {
    this.cargando.set(true); this.error.set('');
    this.config.cargar().subscribe({
      next: () => { this.restaurante.set(this.config.ubicacionRestaurante()); this.cargando.set(false); this.estado.set(''); },
      error: () => { this.estado.set(''); this.error.set('No se pudo cargar la configuración. Intenta nuevamente.'); }
    });
  }
  guardar(value: boolean) {
    const previous = this.config.permiteFechaTrabajo();
    this.config.permiteFechaTrabajo.set(value);
    this.guardando.set(true); this.error.set(''); this.estado.set('Guardando…');
    this.config.guardarFechaTrabajo(value).subscribe({
      next: () => { this.guardando.set(false); this.estado.set('Cambios guardados'); },
      error: () => { this.config.permiteFechaTrabajo.set(previous); this.guardando.set(false); this.estado.set(''); this.error.set('No se guardó el cambio. Intenta nuevamente.'); }
    });
  }
  seleccionarRestaurante(value: MapLocation) { this.restaurante.set(value); }
  guardarRestaurante() {
    const value = this.restaurante();
    if (!value) return;
    this.guardandoUbicacion.set(true); this.error.set(''); this.estado.set('Guardando ubicación…');
    this.config.guardarUbicacionRestaurante(value).subscribe({
      next: () => { this.guardandoUbicacion.set(false); this.estado.set('Ubicación del restaurante guardada'); },
      error: () => { this.guardandoUbicacion.set(false); this.estado.set(''); this.error.set('No se pudo guardar la ubicación del restaurante.'); }
    });
  }
}
