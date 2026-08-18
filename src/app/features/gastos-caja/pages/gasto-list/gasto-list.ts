import { Component, computed, signal } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { DataTable, DateRangePicker, DateRangeValue, FilterBar, isWithinDateRange } from '../../../../shared/components';
import { AnularMovimientoDialog } from '../../../movimiento-cajas/components/anular-movimiento-dialog/anular-movimiento-dialog';
import { GastoCaja, GastoCajaService } from '../../services/gasto-caja-service';

@Component({
  selector: 'app-gasto-list',
  imports: [DataTable, DateRangePicker, FilterBar, AnularMovimientoDialog],
  templateUrl: './gasto-list.html',
  styleUrl: './gasto-list.css',
})
export class GastoList {
  gastos = signal<GastoCaja[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  dateRange = signal<DateRangeValue>({ from: null, to: null, includeTime: false });
  filteredGastos = computed(() => this.gastos().filter(item => isWithinDateRange(item.created_at, this.dateRange())));
  gastoAAnular = signal<GastoCaja | null>(null);
  anulando = signal(false);
  columns = [
    { key: 'created_at', label: 'Fecha', type: 'date' },
    { key: 'categoria', label: 'Categoría' },
    { key: 'concepto', label: 'Concepto' },
    { key: 'monto', label: 'Monto', type: 'expenseAmount' },
    { key: 'usuario.name', label: 'Usuario' },
    { key: 'estado', label: 'Estado', type: 'status' },
  ];
  rowActions = [{
    type: 'cancel', label: 'Anular', class: 'action-btn--delete',
    visible: (item: GastoCaja) => String(item.estado).toUpperCase() === 'ACTIVO',
  }];

  constructor(private service: GastoCajaService, private toastr: ToastrService) {}

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
    this.gastoAAnular.set(event.item);
  }

  confirmarAnulacion(motivo: string) {
    const gasto = this.gastoAAnular();
    if (!gasto || this.anulando()) return;
    this.anulando.set(true);
    this.service.anular(gasto.id, motivo).subscribe({
        next: actualizado => {
          this.gastos.update(items => items.map(item => item.id === actualizado.id ? actualizado : item));
          this.anulando.set(false);
          this.gastoAAnular.set(null);
          this.toastr.success('Gasto anulado correctamente.');
        },
        error: error => { this.anulando.set(false); this.toastr.error(this.errorMessage(error, 'No se pudo anular el gasto.')); },
      });
  }

  private errorMessage(error: any, fallback: string): string {
    return error?.error?.message || Object.values(error?.error?.errors ?? {}).flat().join(' ') || fallback;
  }
  onDateRangeChange(range: DateRangeValue) { this.dateRange.set(range); }
}
