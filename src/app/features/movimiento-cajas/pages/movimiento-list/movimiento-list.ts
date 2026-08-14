import { Component, signal } from '@angular/core';
import { DataTable } from '../../../../shared/components';
import { MovimientoCaja, MovimientoService } from '../../services/movimiento-service';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { AnularMovimientoDialog } from '../../components/anular-movimiento-dialog/anular-movimiento-dialog';

@Component({
  selector: 'app-movimiento-list',
  imports: [DataTable],
  templateUrl: './movimiento-list.html',
  styleUrl: './movimiento-list.css',
})
export class MovimientoList {
  movimientos = signal<MovimientoCaja[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  columns = [
    { key: 'created_at', label: 'Fecha', type: 'date' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'motivo', label: 'Motivo' },
    { key: 'monto', label: 'Monto', type: 'movementAmount' },
    { key: 'usuario.name', label: 'Usuario' },
    { key: 'estado', label: 'Estado', type: 'status' },
  ];
  rowActions = [{
    type: 'cancel', label: 'Anular', icon: 'ti ti-ban', class: 'action-btn--delete',
    visible: (item: MovimientoCaja) => item.estado === 'ACTIVO',
  }];

  constructor(private service: MovimientoService, private dialog: MatDialog, private toastr: ToastrService) {}

  ngOnInit() { this.cargar(); }

  cargar() {
    this.loading.set(true);
    this.error.set(null);
    this.service.listar().subscribe({
      next: data => { this.movimientos.set(data); this.loading.set(false); },
      error: err => { this.error.set(this.errorMessage(err, 'No se pudieron cargar los movimientos.')); this.loading.set(false); },
    });
  }

  handleAction(event: { type: string; item: MovimientoCaja }) {
    if (event.type !== 'cancel') return;
    this.dialog.open(AnularMovimientoDialog, { width: '460px', data: event.item }).afterClosed().subscribe(motivo => {
      if (!motivo) return;
      this.service.anular(event.item.id, motivo).subscribe({
        next: actualizado => {
          this.movimientos.update(items => items.map(item => item.id === actualizado.id ? actualizado : item));
          this.toastr.success('Movimiento anulado correctamente.');
        },
        error: err => this.toastr.error(this.errorMessage(err, 'No se pudo anular el movimiento.')),
      });
    });
  }

  private errorMessage(err: any, fallback: string): string {
    return err?.error?.message || Object.values(err?.error?.errors ?? {}).flat().join(' ') || fallback;
  }

}
