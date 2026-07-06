import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { Order, PosService } from '../../services';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-orden-show',
  imports: [CommonModule, MatDialogModule, MatTabsModule, MatButtonModule],
  templateUrl: './orden-show.html',
  styleUrl: './orden-show.css',
})
export class OrdenShow implements OnInit {
  orden = signal<Order | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);

  constructor(
    @Inject(MatDialogRef) public dialogRef: MatDialogRef<OrdenShow>,
    @Inject(MAT_DIALOG_DATA) public data: { orderId: number },
    private posService: PosService
  ) {}

  ngOnInit(): void {
    if (this.data?.orderId) {
      this.cargarOrden(this.data.orderId);
    }
  }

  private cargarOrden(id: number) {
    this.isLoading.set(true);
    this.posService.obtenerOrdenPorId(id).subscribe({
      next: (response) => {
        this.orden.set(response.orden);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Error al cargar la orden');
        this.isLoading.set(false);
      }
    });
  }

  onClose(): void {
    this.dialogRef.close();
  }

  calcularSubtotalDetalle(cantidad: number, precio: number): number {
    return cantidad * precio;
  }
}
