import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '@app/core/services/auth-service';
import { ReverbService } from '@app/core/services/reverb-service';
import { PuestosCocinaService, PuestoCocina, CocinaControlResponse } from '../../services/puestos-cocina';
import { KdsOrden } from '../../services/cocina-service';

@Component({
  selector: 'app-cocina-control',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cocina-control.html',
  styleUrl: './cocina-control.css',
})
export class CocinaControlPage implements OnInit, OnDestroy {
  usuario = signal<CocinaControlResponse['usuario'] | null>(null);
  puesto = signal<PuestoCocina | null>(null);
  ordenesDisponibles = signal<KdsOrden[]>([]);
  estado = signal<string>('sin_orden');
  puestos = signal<PuestoCocina[]>([]);
  isLoading = signal(true);
  mostrarSeleccionOrden = signal(false);
  ordenSeleccionadaId = signal<number | null>(null);
  error = signal<string | null>(null);
  private subscriptions: Subscription[] = [];

  tienePuesto = computed(() => this.puesto() !== null);
  ordenActual = computed(() => this.puesto()?.orden || null);

  constructor(
    private readonly authService: AuthService,
    private readonly puestosService: PuestosCocinaService,
    private readonly reverb: ReverbService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.cargarControl();
    this.escucharEventos();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private cargarControl(): void {
    this.isLoading.set(true);
    this.puestosService.obtenerControlPuesto().subscribe({
      next: (response) => {
        // backend may return different property names; handle both shapes
        this.usuario.set((response as any).usuario ?? null);
        this.puesto.set((response as any).puesto ?? (response as any).puesto_actual ?? null);
        this.estado.set((response as any).estado ?? 'sin_orden');
        this.puestos.set((response as any).puestos ?? []);
        this.ordenesDisponibles.set((response as any).ordenes_disponibles ?? (response as any).pedidos_disponibles ?? []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudo cargar el panel de control.');
        this.isLoading.set(false);
      },
    });
  }

  abrirSeleccionPuesto(): void {
    this.mostrarSeleccionOrden.set(false);
  }

  ocuparPuesto(puesto: PuestoCocina): void {
    if (puesto.user_id !== null) {
      return;
    }

    this.puestosService.ocuparPuesto(puesto.id).subscribe({
      next: (response) => {
        this.puesto.set(response.puesto);
        this.puestos.update((items) => items.map((item) => item.id === response.puesto.id ? response.puesto : item));
      },
      error: () => {
        this.error.set('No se pudo ocupar el puesto.');
      },
    });
  }

  elegirPedido(): void {
    this.mostrarSeleccionOrden.set(true);
  }

  asignarOrden(): void {
    const puesto = this.puesto();
    const ordenId = this.ordenSeleccionadaId();

    if (!puesto || !ordenId) {
      this.error.set('Selecciona un pedido disponible.');
      return;
    }

    this.puestosService.asignarOrden(puesto.id, ordenId).subscribe({
      next: (response) => {
        console.log('Orden asignada al puesto', response);
        this.puesto.set(response.puesto);
        this.ordenesDisponibles.update((ordenes) => ordenes.filter((orden) => orden.id !== ordenId));
        this.mostrarSeleccionOrden.set(false);
      },
      error: (err) => {
        console.error('Error al asignar orden al puesto', err);
        this.error.set(err?.error?.message || 'No se pudo asignar el pedido.');
      },
    });
  }

  cambiarPedido(): void {
    this.mostrarSeleccionOrden.set(true);
  }

  liberarOrden(): void {
    const puesto = this.puesto();
    if (!puesto) {
      return;
    }

    this.puestosService.liberarOrden(puesto.id).subscribe({
      next: (response) => {
        this.puesto.set(response.puesto);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudo liberar la orden actual.');
      },
    });
  }

  marcarLista(): void {
    const puesto = this.puesto();
    if (!puesto) {
      return;
    }

    this.puestosService.marcarOrdenLista(puesto.id).subscribe({
      next: (response) => {
        this.puesto.set(response.puesto);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudo marcar la orden como lista.');
      },
    });
  }

  seleccionarOrden(id: number): void {
    this.ordenSeleccionadaId.set(id);
  }

  private escucharEventos(): void {
    this.subscriptions.push(
      this.reverb.escucharCanal('canal-ordenes', '.PuestoCocinaActualizado').subscribe((data: any) => {
        console.log('Evento recibido PuestoCocinaActualizado', data);
        if (data?.id) {
          const updatedPuesto = data.orden ? { ...data, orden: data.orden } : { ...data };
          this.puestos.update((items) => items.map((p) => p.id === data.id ? updatedPuesto : p));
          if (this.puesto()?.id === data.id) {
            this.puesto.set(updatedPuesto);
          }
        }
      }),
      this.reverb.escucharCanal('canal-ordenes', '.PuestoCocinaOrdenAsignada').subscribe((data: any) => {
        console.log('Evento recibido PuestoCocinaOrdenAsignada', data);
        const ordenId = (data as any).orden_id ?? (data as any).orden?.id ?? null;
        if (ordenId) {
          this.ordenesDisponibles.update((ordenes) => ordenes.filter((o) => o.id !== ordenId));
        }
        if (data?.id) {
          const updatedPuesto = data.orden ? { ...data, orden: data.orden } : { ...data };
          this.puestos.update((items) => items.map((p) => p.id === data.id ? updatedPuesto : p));
          if (this.puesto()?.id === data.id) {
            this.puesto.set(updatedPuesto);
          }
        }
      }),
      this.reverb.escucharCanal('canal-ordenes', '.PuestoCocinaOrdenLista').subscribe((data: any) => {
        console.log('Evento recibido PuestoCocinaOrdenLista', data);
        if (data?.puesto?.id) {
          this.puestos.update((items) => items.map((p) => p.id === data.puesto.id ? { ...p, ...data.puesto } : p));
          if (this.puesto()?.id === data.puesto.id) {
            this.puesto.update((puesto) => puesto ? { ...puesto, ...data.puesto } : puesto);
          }
        }
        if (data?.orden_id) {
          const finishedId = data.orden_id;
          this.ordenesDisponibles.update((ordenes) => ordenes.filter((o) => o.id !== finishedId));
        }
      }),
      // Escuchar actualizaciones de ordenes (nuevas ordenes / cambios)
      this.reverb.escucharCanal('canal-ordenes', '.OrdenCocinaActualizada').subscribe((data: any) => {
        if (data?.orden_id) this.cargarControl();
      }),
    );
  }
}
