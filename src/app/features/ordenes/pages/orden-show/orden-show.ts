import { CommonModule } from '@angular/common';
import { Component, OnInit, input, signal } from '@angular/core';
import { PosService } from '../../services';

@Component({ selector: 'app-orden-show', imports: [CommonModule], templateUrl: './orden-show.html', styleUrl: './orden-show.css' })
export class OrdenShow implements OnInit {
  orderId = input.required<number>();
  orden = signal<any | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);

  constructor(private posService: PosService) {}

  ngOnInit(): void { this.cargarOrden(this.orderId()); }

  detalles(): any[] { return this.orden()?.detalles ?? this.orden()?.items ?? []; }
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
      next: response => { this.orden.set(response.orden); this.isLoading.set(false); },
      error: () => { this.error.set('No se pudo cargar el detalle del pedido.'); this.isLoading.set(false); },
    });
  }
}
