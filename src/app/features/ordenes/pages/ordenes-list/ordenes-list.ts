import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { timeout } from 'rxjs/internal/operators/timeout';
import { ToastrService } from 'ngx-toastr';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog-service';
import { DataTable, DataTableQuery, DateRangePicker, DateRangeValue, FilterBar, Modal } from '../../../../shared/components';
import { Order, PosService } from '../../services';
import { OrdenShow } from '../orden-show/orden-show';
import { Subscription } from 'rxjs/internal/Subscription';
import { ReverbService } from '@app/core/services/reverb-service';

@Component({
  selector: 'app-ordenes-list',
  standalone: true, // Asegúrate de tenerlo si es un componente independiente
  imports: [CommonModule, DataTable, Modal, OrdenShow, FilterBar, DateRangePicker],
  templateUrl: './ordenes-list.html',
  styleUrl: './ordenes-list.css',
})
export class OrdenesList implements OnInit, OnDestroy {
  ordenes = signal<Order[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);
  errorMessageLink = signal<string | null>(null);
  errorMessageText = signal<string | null>(null);
  private reverbSub = new Subscription();
  selectedOrder = signal<Order | null>(null);
  dateRange = signal<DateRangeValue>({ from: null, to: null, includeTime: false });
  currentPage = signal(1);
  pageSize = signal(10);
  totalOrders = signal(0);
  private tableQuery: DataTableQuery = { search: '', filters: {}, sortKey: 'created_at', sortDirection: 'desc' };
  rowActions = [
    { type: 'edit', label: 'Editar', icon: 'edit', iconOnly: true },
    { type: 'view', label: 'Ver', icon: 'eye', iconOnly: true },
    { type: 'activate', label: 'Activar', icon: 'play', iconOnly: true, class: 'success', visible: (item: Order) => item.tipo_flujo === 'preorden' && item.estado_preorden === 'programada' },
    { type: 'delete', label: 'Eliminar', icon: 'trash', iconOnly: true, class: 'delete' },
  ];

  constructor(
    private posService: PosService,
    private router: Router,
    private toastr: ToastrService,
    private confirmDialog: ConfirmDialogService,
    private reverb: ReverbService
  ) {}

  ngOnInit(): void {
    // El POS es el módulo más pesado; se descarga en segundo plano mientras se consulta la tabla.
    void import('../../../pos/pages/pos-home/pos-home');
    this.obtenerOrdenes();
    this.escucharNuevasOrdenes();
  }

  escucharNuevasOrdenes() {
    this.reverbSub.add(this.reverb
      .escucharCanal('canal-ordenes', '.OrdenCreada')
      .subscribe((data: any) => {
        if (data?.orden_id) {
          this.obtenerOrdenes();
          this.toastr.info(`Nueva orden #${data.orden_id} recibida`, 'Tiempo Real');
        }
      }));
    this.reverbSub.add(this.reverb
      .escucharCanal('canal-ordenes', '.PreordenActualizada')
      .subscribe(() => this.obtenerOrdenes()));
  }

  obtenerOrdenes() {
    this.isLoading.set(true);
    this.error.set(null);
    this.errorMessageLink.set(null);
    this.errorMessageText.set(null);

    const range = this.dateRange();
    this.posService.obtenerOrdenesPaginadas({
      page: this.currentPage(),
      perPage: this.pageSize(),
      search: this.tableQuery.search,
      sortKey: this.tableQuery.sortKey,
      sortDirection: this.tableQuery.sortDirection,
      dateFrom: range.from,
      dateTo: range.to,
    }).pipe(timeout(10000)).subscribe({
      next: (response) => {
        // 1. Extraemos el arreglo 'ordenes' que viene dentro del objeto de Laravel
        // const listaOriginal = data?.ordenes || [];
        const listaOriginal = response.data || [];

        // 2. Aplanamos las propiedades para que coincidan con las llaves de tu 'app-data-table'
        const ordenesFormateadas = listaOriginal.map((orden: any) => ({
          ...orden,
          numero_orden: orden.numero_orden,
          tipo_orden_label: orden.tipo_orden === 'dine-in'
            ? 'En mesa'
            : orden.tipo_orden === 'to-go' ? 'Para llevar' : 'Entrega',
          tipo_flujo_label: orden.tipo_flujo === 'preorden' ? 'Preorden' : 'Normal',
          estado_preorden_label: orden.estado_solicitud === 'rechazada'
            ? 'SOLICITUD RECHAZADA'
            : orden.estado_preorden ? orden.estado_preorden.toUpperCase() : '—',
          
          // Si hay cliente usa su nombre, si no, usa observaciones o un respaldo por defecto
          cliente_nombre: orden.cliente 
            ? orden.cliente.nombre 
            : (orden.observaciones || 'Venta Rápida'),
            
          // Forzamos el total a número para evitar alineaciones incorrectas de strings
          total: parseFloat(orden.total) 
        }));

        // 3. Guardamos la lista lista para iterar en el Signal
        this.ordenes.set(ordenesFormateadas);
        this.currentPage.set(response.current_page);
        this.pageSize.set(response.per_page);
        this.totalOrders.set(response.total);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.error.set('Error al cargar órdenes');
      }
    });
  }

  handleAction(event: { type: string, item: Order }): void {
    const { type, item } = event;

    if (type === 'edit') {
      // Navega al POS pasando el ID de la orden para editarla
      this.posService.prepararEdicion(item);
      this.router.navigate(['/pos'], { queryParams: { orderId: item.id, edit: true } });
    }

    if (type === 'view') {
      this.selectedOrder.set(item);
    }

    if (type === 'activate') {
      this.activarPreorden(item);
    }

    if (type === 'delete') {
      this.eliminarOrden(item.id);
    }
  }

  verOrden(orden: Order): void { this.selectedOrder.set(orden); }

  private activarPreorden(orden: Order): void {
    this.confirmDialog.confirm({
      title: 'Activar preorden',
      message: `¿Activar la preorden #${orden.numero_orden || orden.id}? Entrará al flujo operativo inmediatamente.`,
      confirmText: 'Activar',
      confirmColor: 'primary',
    }).subscribe(result => {
      if (!result) return;
      this.posService.activarPreorden(orden.id).subscribe({
        next: () => {
          this.toastr.success('Preorden activada correctamente.');
          this.obtenerOrdenes();
        },
        error: error => this.toastr.error(error?.error?.message || 'No se pudo activar la preorden.'),
      });
    });
  }

  closeOrderDetail(): void {
    this.selectedOrder.set(null);
  }

  onDateRangeChange(range: DateRangeValue): void {
    this.dateRange.set(range);
    this.currentPage.set(1);
    this.obtenerOrdenes();
  }

  onTableQuery(query: DataTableQuery): void { this.tableQuery = query; }

  onPaginationChange(event: { page: number; pageSize: number }): void {
    this.currentPage.set(event.page);
    this.pageSize.set(event.pageSize);
    this.obtenerOrdenes();
  }

  eliminarOrden(id: number) {
    this.confirmDialog.confirm({
      title: 'Eliminar orden',
      message: '¿Estás seguro de eliminar esta orden? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      confirmColor: 'danger',
    }).subscribe(result => {
      if (result) {
        this.posService.eliminarOrden(id).subscribe({
          next: () => {
            this.toastr.success('Orden eliminada correctamente');
            if (this.ordenes().length === 1 && this.currentPage() > 1) this.currentPage.update(page => page - 1);
            this.obtenerOrdenes();
          },
          error: () => {
            this.toastr.error('Error al eliminar la orden');
          }
        });
      }
    });
  }

  ngOnDestroy(): void {
    if (this.reverbSub) {
      this.reverbSub.unsubscribe();
    }
  }
}
