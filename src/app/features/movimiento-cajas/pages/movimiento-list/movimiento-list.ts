import { Component, computed, signal } from '@angular/core';
import { DataTable, DateRangePicker, DateRangeValue, FilterBar, isWithinDateRange } from '../../../../shared/components';
import { MovimientoCaja, MovimientoService } from '../../services/movimiento-service';
import { ToastrService } from 'ngx-toastr';
import { AnularMovimientoDialog } from '../../components/anular-movimiento-dialog/anular-movimiento-dialog';

@Component({
  selector: 'app-movimiento-list',
  imports: [DataTable, DateRangePicker, FilterBar, AnularMovimientoDialog],
  templateUrl: './movimiento-list.html',
  styleUrl: './movimiento-list.css',
})
export class MovimientoList {
  movimientos = signal<MovimientoCaja[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  dateRange = signal<DateRangeValue>({ from: null, to: null, includeTime: false });
  filteredMovimientos = computed(() => this.movimientos().filter(item => isWithinDateRange(item.created_at, this.dateRange())));
  movimientoAAnular = signal<MovimientoCaja | null>(null);
  anulando = signal(false);
  columns = [
    { key: 'created_at', label: 'Fecha', type: 'date' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'motivo', label: 'Motivo' },
    { key: 'monto', label: 'Monto', type: 'movementAmount' },
    { key: 'usuario.name', label: 'Usuario' },
    { key: 'estado', label: 'Estado', type: 'status' },
  ];
  rowActions = [{
    type: 'cancel', label: 'Anular', class: 'action-btn--delete',
    visible: (item: MovimientoCaja) => String(item.estado).toUpperCase() === 'ACTIVO',
  }];

  constructor(private service: MovimientoService, private toastr: ToastrService) {}

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
    this.movimientoAAnular.set(event.item);
  }

  confirmarAnulacion(motivo: string) {
    const movimiento = this.movimientoAAnular();
    if (!movimiento || this.anulando()) return;
    this.anulando.set(true);
    this.service.anular(movimiento.id, motivo).subscribe({
        next: actualizado => {
          this.movimientos.update(items => items.map(item => item.id === actualizado.id ? actualizado : item));
          this.anulando.set(false);
          this.movimientoAAnular.set(null);
          this.toastr.success('Movimiento anulado correctamente.');
        },
        error: err => { this.anulando.set(false); this.toastr.error(this.errorMessage(err, 'No se pudo anular el movimiento.')); },
      });
  }

  private errorMessage(err: any, fallback: string): string {
    return err?.error?.message || Object.values(err?.error?.errors ?? {}).flat().join(' ') || fallback;
  }

  onDateRangeChange(range: DateRangeValue) { this.dateRange.set(range); }

}
