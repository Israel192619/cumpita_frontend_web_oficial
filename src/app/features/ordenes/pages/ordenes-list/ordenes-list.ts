import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { timeout } from 'rxjs/internal/operators/timeout';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog-service';
import { DataTable } from '../../../../shared/components';
import { Order, PosService } from '../../services';
import { OrdenShow } from '../orden-show/orden-show';
import { Subscription } from 'rxjs/internal/Subscription';
import { ReverbService } from '@app/core/services/reverb-service';

@Component({
  selector: 'app-ordenes-list',
  standalone: true, // Asegúrate de tenerlo si es un componente independiente
  imports: [CommonModule, DataTable],
  templateUrl: './ordenes-list.html',
  styleUrl: './ordenes-list.css',
})
export class OrdenesList implements OnInit, OnDestroy {
  ordenes = signal<Order[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);
  errorMessageLink = signal<string | null>(null);
  errorMessageText = signal<string | null>(null);
  private reverbSub!: Subscription;

  constructor(
    private posService: PosService,
    private router: Router,
    private toastr: ToastrService,
    private confirmDialog: ConfirmDialogService,
    private dialog: MatDialog,
    private reverb: ReverbService
  ) {}

  ngOnInit(): void {
    this.obtenerOrdenes();
    this.escucharNuevasOrdenes();
  }

  escucharNuevasOrdenes() {
    this.reverbSub = this.reverb
      .escucharCanal('canal-ordenes', '.OrdenCreada')
      .subscribe((data: any) => {
        const nuevaOrdenRaw = data.orden;

        if (nuevaOrdenRaw) {
          // Aplanamos las propiedades de la nueva orden para que coincida con tu formato de la tabla
          const ordenFormateada: any = {
            ...nuevaOrdenRaw,
            numero_orden: `#${nuevaOrdenRaw.id}`,
            cliente_nombre: nuevaOrdenRaw.cliente 
              ? nuevaOrdenRaw.cliente.nombre 
              : (nuevaOrdenRaw.observaciones || 'Venta Rápida'),
            total: parseFloat(nuevaOrdenRaw.total)
          };

          // Actualizamos el Signal agregando la nueva orden al inicio de la lista
          this.ordenes.update((listaActual) => [ordenFormateada, ...listaActual]);
          
          // Opcional: Mostrar una pequeña notificación visual en la esquina
          this.toastr.info(`Nueva orden ${ordenFormateada.numero_orden} recibida`, 'Tiempo Real');
        }
      });
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
          numero_orden: `#${orden.id}`, // Genera el número visual (ej: #1)
          
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
      // Abre el modal orden-show
      this.dialog.open(OrdenShow, {
        data: { orderId: item.id },
        width: '800px',
        maxHeight: '90vh',
        panelClass: 'orden-show-dialog'
      });
    }

    if (type === 'delete') {
      this.eliminarOrden(item.id);
    }
  }

  eliminarOrden(id: number) {
    this.confirmDialog.confirm({
      title: 'Eliminar orden',
      message: '¿Estás seguro de eliminar esta orden? Esta acción no se puede deshacer.'
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
