import { Component, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { timeout } from 'rxjs/internal/operators/timeout';
import { ToastrService } from 'ngx-toastr';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog-service';
import { Button, DataTable, DateRangePicker, DateRangeValue, FilterBar, isWithinDateRange, Modal } from '../../../../shared/components';
import { Order, PosService } from '../../services';
import { OrdenShow } from '../orden-show/orden-show';
import { Subscription } from 'rxjs/internal/Subscription';
import { ReverbService } from '@app/core/services/reverb-service';

@Component({
  selector: 'app-ordenes-list',
  standalone: true, // Asegúrate de tenerlo si es un componente independiente
  imports: [CommonModule, DataTable, Modal, Button, OrdenShow, FilterBar, DateRangePicker],
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
  filteredOrders = computed(() => this.ordenes().filter(order => isWithinDateRange(
    order.tipo_flujo === 'preorden' && order.estado_preorden === 'programada'
      ? order.fecha_programada
      : (order.fecha_orden || order.created_at),
    this.dateRange(),
  )));
  rowActions = [
    { type: 'edit', label: 'Editar', icon: 'edit' },
    { type: 'view', label: 'Ver', icon: 'eye' },
    { type: 'activate', label: 'Activar', class: 'success', visible: (item: Order) => item.tipo_flujo === 'preorden' && item.estado_preorden === 'programada' },
    { type: 'delete', label: 'Eliminar', icon: 'trash', class: 'delete' },
  ];

  constructor(
    private posService: PosService,
    private router: Router,
    private toastr: ToastrService,
    private confirmDialog: ConfirmDialogService,
    private reverb: ReverbService
  ) {}

  ngOnInit(): void {
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

    this.posService.obtenerOrdenes().pipe(timeout(10000)).subscribe({
      next: (data: any) => {
        // 1. Extraemos el arreglo 'ordenes' que viene dentro del objeto de Laravel
        // const listaOriginal = data?.ordenes || [];
        const listaOriginal = data || [];

        // 2. Aplanamos las propiedades para que coincidan con las llaves de tu 'app-data-table'
        const ordenesFormateadas = listaOriginal.map((orden: any) => ({
          ...orden,
          numero_orden: orden.numero_orden,
          tipo_flujo_label: orden.tipo_flujo === 'preorden' ? 'Preorden' : 'Normal',
          estado_preorden_label: orden.estado_preorden ? orden.estado_preorden.toUpperCase() : '—',
          
          // Si hay cliente usa su nombre, si no, usa observaciones o un respaldo por defecto
          cliente_nombre: orden.cliente 
            ? orden.cliente.nombre 
            : (orden.observaciones || 'Venta Rápida'),
            
          // Forzamos el total a número para evitar alineaciones incorrectas de strings
          total: parseFloat(orden.total) 
        }));

        // 3. Guardamos la lista lista para iterar en el Signal
        this.ordenes.set(ordenesFormateadas);
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

  onDateRangeChange(range: DateRangeValue): void { this.dateRange.set(range); }

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
            this.ordenes.update(ordenes => ordenes.filter(o => o.id !== id));
            this.toastr.success('Orden eliminada correctamente');
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
