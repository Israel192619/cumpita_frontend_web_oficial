import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataTable, Modal } from '../../../../shared/components';
import { AjusteStock, ProductoService } from '../../services/producto-service';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog-service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-ajustes-stock-list',
  imports: [CommonModule, DataTable, Modal],
  templateUrl: './ajustes-stock-list.html',
  styleUrl: './ajustes-stock-list.css',
})
export class AjustesStockList {
  ajustes = signal<AjusteStock[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  selectedAdjustment = signal<AjusteStock | null>(null);
  reverting = signal(false);
  readonly columns = [
    { key: 'created_at', label: 'Fecha', type: 'date' },
    { key: 'producto.nombre', label: 'Producto' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'cantidad', label: 'Cantidad' },
    { key: 'stock_anterior', label: 'Stock anterior' },
    { key: 'stock_final', label: 'Stock final' },
    { key: 'motivo', label: 'Motivo' },
    { key: 'usuario.name', label: 'Registrado por' },
  ];
  readonly rowActions = [
    { type: 'view', label: 'Ver', icon: 'eye' },
    { type: 'revert', label: 'Revertir', icon: 'arrow-up-right-circle', class: 'action-btn--delete', visible: (item: AjusteStock) => !item.revertido_por_ajuste_id },
  ];

  constructor(private service: ProductoService, private confirmDialog: ConfirmDialogService, private toastr: ToastrService) {}

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.listarAjustesStock().subscribe({
      next: ajustes => { this.ajustes.set(ajustes); this.loading.set(false); },
      error: err => { this.error.set(err?.error?.message || 'No se pudieron cargar los ajustes de stock.'); this.loading.set(false); },
    });
  }

  handleAction(event: { type: string; item: AjusteStock }): void {
    if (event.type === 'view') this.selectedAdjustment.set(event.item);
    if (event.type === 'revert') this.confirmarReversion(event.item);
  }

  confirmarReversion(ajuste: AjusteStock): void {
    this.confirmDialog.confirm({
      title: 'Revertir ajuste',
      message: `Se creará un nuevo ajuste inverso para “${ajuste.producto.nombre}”. El registro original se conservará.`,
      confirmText: 'Revertir',
    }).subscribe(confirmado => {
      if (!confirmado || this.reverting()) return;
      this.reverting.set(true);
      this.service.revertirAjusteStock(ajuste.id).subscribe({
        next: () => { this.toastr.success('Ajuste revertido correctamente.'); this.reverting.set(false); this.selectedAdjustment.set(null); this.cargar(); },
        error: err => { this.toastr.error(err?.error?.message || 'No se pudo revertir el ajuste.'); this.reverting.set(false); },
      });
    });
  }
}
