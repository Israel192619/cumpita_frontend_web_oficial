import { Component, inject, signal } from '@angular/core';
import { ConfiguracionService } from '../../core/services/configuracion-service';

@Component({
  selector: 'app-configuracion',
  template: `
    <header><h1>Configuración</h1><p>Personaliza el funcionamiento de tu negocio.</p></header>
    <div class="settings-layout">
      <nav aria-label="Secciones de configuración"><button type="button" aria-current="page">POS</button></nav>
      <section aria-labelledby="pos-title">
        <h2 id="pos-title">POS</h2><p>Opciones del punto de venta.</p>
        <label class="setting"><input type="checkbox" [checked]="config.permiteFechaTrabajo()" [disabled]="cargando() || guardando()" (change)="guardar($any($event.target).checked)">
          <span><strong>Edición de fecha de trabajo</strong><small>Permite elegir la fecha y hora de trabajo al crear o editar órdenes. Si está desactivado, las nuevas órdenes usan la fecha y hora del sistema y las existentes conservan su fecha original.</small></span>
        </label>
        <p class="hint">Los cambios se guardan automáticamente. La programación de preórdenes se mantiene disponible.</p>
        <p role="status" aria-live="polite">{{ estado() }}</p>
        @if (error()) { <p role="alert" class="error">{{ error() }}</p><button type="button" (click)="cargar()">Volver a cargar</button> }
      </section>
    </div>`,
  styles: [`:host{display:block;padding:clamp(16px,3vw,32px);color:var(--color-text)}h1{margin:0;font-size:1.7rem}header p,section>p{color:var(--color-text-secondary)}.settings-layout{display:grid;grid-template-columns:200px minmax(0,1fr);gap:24px;margin-top:24px}nav,section{background:var(--color-surface);border:1px solid var(--color-border);border-radius:12px;padding:20px}nav{align-self:start;padding:8px}button{font:inherit;cursor:pointer;padding:12px;border-radius:8px;border:1px solid var(--color-border);background:var(--color-surface);color:var(--color-text)}nav button{width:100%;text-align:left;background:var(--color-primary);color:var(--color-on-primary,#fff);font-weight:700}h2{margin-top:0}.setting{display:flex;gap:14px;align-items:flex-start;padding:20px 0;border-top:1px solid var(--color-border);cursor:pointer}.setting input{width:22px;height:22px;flex-shrink:0;accent-color:var(--color-primary)}small{display:block;line-height:1.6;margin-top:8px;color:var(--color-text-secondary);max-width:680px}.hint{font-size:.85rem}.error{color:var(--color-danger)}@media(max-width:700px){.settings-layout{grid-template-columns:1fr;gap:12px}}`]
})
export class Configuracion {
  readonly config = inject(ConfiguracionService);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly estado = signal('Cargando configuración…');
  readonly error = signal('');
  constructor() { this.cargar(); }
  cargar() {
    this.cargando.set(true); this.error.set('');
    this.config.cargar().subscribe({
      next: () => { this.cargando.set(false); this.estado.set(''); },
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
}
