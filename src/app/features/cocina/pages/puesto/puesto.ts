import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { CocinaService, KdsOrden } from '../../services/cocina-service';
import { PuestosCocinaService, PuestoCocina } from '../../services/puestos-cocina';

@Component({
  selector: 'app-cocina-puesto',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './puesto.html',
  styleUrl: './puesto.css',
})
export class PuestoPage implements OnInit {
  puesto = signal<PuestoCocina | null>(null);
  ordenes = signal<KdsOrden[]>([]);
  ordenModalAbierto = signal(false);
  ordenSeleccionada = signal<KdsOrden | null>(null);
  ordenListoGuardando = signal(false);
  isLoading = signal<boolean>(true);
  isLoadingPuesto = signal<boolean>(true);
  error = signal<string | null>(null);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cocinaService: CocinaService,
    private readonly puestosCocinaService: PuestosCocinaService,
    private readonly toastr: ToastrService,
  ) {}

  ngOnInit(): void {
    const puestoId = Number(this.route.snapshot.paramMap.get('puestoId'));

    if (!puestoId) {
      this.error.set('Puesto inválido.');
      this.isLoading.set(false);
      return;
    }

    this.cargarPuesto(puestoId);
    this.cargarOrdenes();
  }

  private cargarPuesto(puestoId: number): void {
    this.puestosCocinaService.obtenerPuestos().subscribe({
      next: (response) => {
        const selected = response.puestos.find((puesto) => puesto.id === puestoId) ?? null;
        this.puesto.set(selected);
        this.isLoadingPuesto.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el puesto.');
        this.isLoadingPuesto.set(false);
      },
    });
  }

  private cargarOrdenes(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.cocinaService.obtenerPedidos(today).subscribe({
      next: (response) => {
        this.ordenes.set(response.ordenes || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las órdenes.');
        this.isLoading.set(false);
      },
    });
  }

  abrirModalOrden(orden: KdsOrden): void {
    this.ordenSeleccionada.set(orden);
    this.ordenModalAbierto.set(true);
  }

  cerrarModalOrden(): void {
    this.ordenModalAbierto.set(false);
    this.ordenSeleccionada.set(null);
  }

  marcarOrdenListo(): void {
    const orden = this.ordenSeleccionada();
    const puesto = this.puesto();

    if (!orden || !puesto) {
      return;
    }

    this.ordenListoGuardando.set(true);
    this.puestosCocinaService.marcarOrdenLista(puesto.id).subscribe({
      next: (response) => {
        this.ordenes.update((ordenes) => ordenes.filter((item) => item.id !== orden.id));
        this.puesto.set(response.puesto);
        this.toastr.success(`Orden #${orden.numero_orden || orden.id} marcada como lista.`);
        this.cerrarModalOrden();
        this.ordenListoGuardando.set(false);
      },
      error: () => {
        this.toastr.error('No se pudo marcar la orden como lista.');
        this.ordenListoGuardando.set(false);
      },
    });
  }

  volver(): void {
    this.router.navigate(['/cocina']);
  }
}
