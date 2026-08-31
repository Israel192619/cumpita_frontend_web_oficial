import { CommonModule } from '@angular/common';
import { Component, OnInit, input, signal } from '@angular/core';
import { PosService } from '../../services';
import { AppCurrencyPipe } from '@app/shared/pipes/app-currency.pipe';

@Component({ selector: 'app-orden-show', imports: [CommonModule, AppCurrencyPipe], templateUrl: './orden-show.html', styleUrls: ['./orden-show.css', './orden-show-removed.css'] })
export class OrdenShow implements OnInit {
  orderId = input.required<number>();
  orden = signal<any | null>(null);
  historial = signal<any[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);

  constructor(private posService: PosService) {}

  ngOnInit(): void { this.cargarOrden(this.orderId()); }

  detalles(): any[] { return this.orden()?.detalles ?? this.orden()?.items ?? []; }
  detallesRetirados(): any[] {
    const agrupados = new Map<string, any>();
    this.historial().filter(cambio => cambio.tipo_cambio === 'detalle_eliminado').forEach(cambio => {
      const datos = cambio.datos_anterior ?? {};
      const nombre = cambio.producto?.nombre ?? datos.producto_nombre ?? 'Producto';
      const precio = Number(datos.precio_unitario ?? 0);
      const cantidad = Number(cambio.cantidad_anterior ?? datos.cantidad ?? 0);
      const clave = `${cambio.producto_id ?? datos.producto_id ?? nombre}::${precio}`;
      const existente = agrupados.get(clave);
      if (existente) { existente.cantidad += cantidad; existente.subtotal += precio * cantidad; return; }
      agrupados.set(clave, { clave, nombre, cantidad, precio, subtotal: precio * cantidad });
    });
    return [...agrupados.values()];
  }
  detallesAgrupados(): any[] {
    const agrupados = new Map<string, any>();

    this.detalles().forEach(detalle => {
      const opciones = this.opciones(detalle)
        .map(opcion => `${opcion?.modificador_opcion_id ?? opcion?.opcion_id ?? opcion?.id}:${opcion?.precio_extra ?? 0}`)
        .sort()
        .join('|');
      // Sólo se agrupan unidades realmente iguales. Una nota, un modificador o un
      // precio distinto sigue apareciendo como una línea independiente.
      const clave = [
        detalle?.producto_id ?? detalle?.producto?.id ?? this.productoNombre(detalle),
        this.precioDetalle(detalle),
        detalle?.nota?.trim() ?? '',
        opciones,
      ].join('::');
      const cantidad = Number(detalle?.cantidad ?? 0);
      const total = this.totalDetalle(detalle);
      const existente = agrupados.get(clave);

      if (existente) {
        existente.cantidad += cantidad;
        existente.subtotal += total;
        return;
      }

      agrupados.set(clave, {
        ...detalle,
        groupKey: clave,
        cantidad,
        subtotal: total,
      });
    });

    return [...agrupados.values()];
  }
  pagos(): any[] { return this.orden()?.pagos ?? []; }
  opciones(detalle: any): any[] { return detalle?.opciones ?? detalle?.modificadores ?? []; }
  opcionNombre(opcion: any): string { return opcion?.modificador_opcion?.nombre ?? opcion?.opcion_nombre ?? opcion?.nombre ?? 'Opción'; }
  productoNombre(detalle: any): string { return detalle?.producto?.nombre ?? detalle?.producto_nombre ?? 'Producto'; }
  precioDetalle(detalle: any): number { return Number(detalle?.precio_unitario ?? 0); }
  totalDetalle(detalle: any): number {
    if (detalle?.subtotal != null) return Number(detalle.subtotal);
    const extras = this.opciones(detalle).reduce((total, opcion) => total + Number(opcion?.precio_extra ?? 0), 0);
    return Number(detalle?.cantidad ?? 0) * (this.precioDetalle(detalle) + extras);
  }
  totalPagado(): number { return this.pagos().reduce((total, pago) => total + Number(pago?.monto_pagado ?? 0), 0); }
  saldoPendiente(): number {
    const orden = this.orden();
    return orden?.saldo_pendiente != null ? Number(orden.saldo_pendiente) : Math.max(0, Number(orden?.total ?? 0) - this.totalPagado());
  }
  etiquetaTipo(tipo?: string): string { return ({ 'dine-in': 'Mesa', 'to-go': 'Para llevar', delivery: 'Delivery' } as Record<string, string>)[tipo ?? ''] ?? tipo ?? '—'; }

  private cargarOrden(id: number): void {
    this.isLoading.set(true); this.error.set(null);
    this.posService.obtenerOrdenPorId(id).subscribe({
      next: response => {
        this.orden.set(response.orden);
        this.isLoading.set(false);
        this.posService.obtenerHistorialOrden(id).subscribe({ next: historial => this.historial.set(historial) });
      },
      error: () => { this.error.set('No se pudo cargar el detalle del pedido.'); this.isLoading.set(false); },
    });
  }
}
