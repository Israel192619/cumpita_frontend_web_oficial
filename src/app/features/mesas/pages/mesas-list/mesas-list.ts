import { Component, signal } from '@angular/core';
import { Mesa } from '../../../../core/models/mesa';
import { MesaService } from '../../services/mesa-service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { timeout } from 'rxjs/internal/operators/timeout';
import { ToastrService } from 'ngx-toastr';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog-service';
import { DataTable } from '../../../../shared/components';

@Component({
  selector: 'app-mesas-list',
  standalone: true,
  imports: [
    CommonModule, DataTable
  ],
  templateUrl: './mesas-list.html',
  styleUrl: './mesas-list.css',
})
export class MesasList {
  mesas = signal<Mesa[]>([]);
  isloading = signal(false);
  error = signal<string | null>(null);
  errorMessageLink = signal<string | null>(null);
  errorMessageText = signal<string | null>(null);
  guardandoPlano = signal(false);
  mesaArrastrada: Mesa | null = null;

  constructor(private mesaService: MesaService, private router: Router, private toastr: ToastrService, private confirmDialog: ConfirmDialogService) { }
  
  ngOnInit(): void {
    this.obtenerMesas();
  }

  posicionX(mesa: Mesa, index: number): number { return mesa.posicion_x ?? 4 + (index % 8) * 11; }
  posicionY(mesa: Mesa, index: number): number { return mesa.posicion_y ?? 78 + Math.floor(index / 8) * 10; }

  iniciarArrastre(event: PointerEvent, mesa: Mesa): void {
    event.preventDefault(); this.mesaArrastrada = mesa;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  moverMesa(event: PointerEvent, plano: HTMLElement): void {
    if (!this.mesaArrastrada) return;
    const rect = plano.getBoundingClientRect();
    const x = Math.max(0, Math.min(92, ((event.clientX - rect.left) / rect.width) * 100 - 4));
    const y = Math.max(0, Math.min(92, ((event.clientY - rect.top) / rect.height) * 100 - 4));
    this.mesas.update(mesas => mesas.map(mesa => mesa.id === this.mesaArrastrada?.id ? { ...mesa, posicion_x: x, posicion_y: y } : mesa));
  }

  terminarArrastre(): void { this.mesaArrastrada = null; }

  guardarPlano(): void {
    this.guardandoPlano.set(true);
    const posiciones = this.mesas().map((mesa, index) => ({ id: mesa.id, posicion_x: this.posicionX(mesa, index), posicion_y: this.posicionY(mesa, index) }));
    this.mesaService.guardarPlano(posiciones).subscribe({
      next: () => { this.guardandoPlano.set(false); this.toastr.success('Distribución del local guardada'); },
      error: () => { this.guardandoPlano.set(false); this.toastr.error('No se pudo guardar la distribución'); }
    });
  }

  obtenerMesas() {
    this.isloading.set(true);
    this.error.set(null);
    this.errorMessageLink.set(null);
    this.errorMessageText.set(null);
    this.mesaService.listarMesas().pipe(timeout(10000)).subscribe({
      next: (data) => {
        this.mesas.set(data);
        this.isloading.set(false);
      },
      error: () => {
        this.isloading.set(false);
        this.error.set('Error al cargar las mesas');
      }
    });
  }

  handleAction(event: { type: string, item: Mesa }): void {
    const { type, item } = event;

    if (type === 'edit') {
      this.router.navigate(['/app/mesas/edit', item.id]);
    }

    if (type === 'delete') {
      this.eliminarMesa(item.id);
    }
  }

  eliminarMesa(id: number) {
    this.confirmDialog.confirm({
      title: 'Eliminar mesa',
      message: '¿Estás seguro de eliminar esta mesa? Esta acción no se puede deshacer.'
    }).subscribe(result => {
      if (result) {
        this.mesaService.eliminarMesa(id).subscribe({
          next: () => {
            this.mesas.update(mesas => mesas.filter(m => m.id !== id));
            this.toastr.success('Mesa eliminada correctamente');
          }
        });
      }
    });
  }
}
