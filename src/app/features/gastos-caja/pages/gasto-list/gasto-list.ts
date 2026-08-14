import { Component, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { DataTable } from '../../../../shared/components';
import { AnularMovimientoDialog } from '../../../movimiento-cajas/components/anular-movimiento-dialog/anular-movimiento-dialog';
import { GastoCaja, GastoCajaService } from '../../services/gasto-caja-service';

@Component({
  selector: 'app-gasto-list',
  imports: [DataTable],
  templateUrl: './gasto-list.html',
  styleUrl: './gasto-list.css',
})
export class GastoList {
  gastos = signal<GastoCaja[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  columns = [
    { key: 'created_at', label: 'Fecha', type: 'date' },
    { key: 'categoria', label: 'Categoría' },
    { key: 'concepto', label: 'Concepto' },
    { key: 'monto', label: 'Monto', type: 'expenseAmount' },
    { key: 'usuario.name', label: 'Usuario' },
    { key: 'estado', label: 'Estado', type: 'status' },
  ];
  rowActions = [{
    type: 'cancel', label: 'Anular', icon: 'ti ti-ban', class: 'action-btn--delete',
    visible: (item: GastoCaja) => item.estado === 'ACTIVO',
  }];

  constructor(private service: GastoCajaService, private dialog: MatDialog, private toastr: ToastrService) {}

  ngOnInit() { this.cargar(); }

  cargar() {
    this.loading.set(true);
    this.error.set(null);
    this.service.listar().subscribe({
      next: gastos => { this.gastos.set(gastos); this.loading.set(false); },
      error: error => { this.error.set(this.errorMessage(error, 'No se pudieron cargar los gastos.')); this.loading.set(false); },
    });
  }

  handleAction(event: { type: string; item: GastoCaja }) {
    if (event.type !== 'cancel') return;
    this.dialog.open(AnularMovimientoDialog, {
      width: '460px', data: { ...event.item, entidad: 'gasto' },
    }).afterClosed().subscribe(motivo => {
      if (!motivo) return;
      this.service.anular(event.item.id, motivo).subscribe({
        next: actualizado => {
          this.gastos.update(items => items.map(item => item.id === actualizado.id ? actualizado : item));
          this.toastr.success('Gasto anulado correctamente.');
        },
        error: error => this.toastr.error(this.errorMessage(error, 'No se pudo anular el gasto.')),
      });
    });
  }

  private errorMessage(error: any, fallback: string): string {
    return error?.error?.message || Object.values(error?.error?.errors ?? {}).flat().join(' ') || fallback;
  }
}
