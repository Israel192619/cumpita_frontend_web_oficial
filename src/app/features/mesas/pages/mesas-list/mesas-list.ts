import { Component, signal } from '@angular/core';
import { Mesa } from '../../../../core/models/mesa';
import { MesaService } from '../../services/mesa-service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { timeout } from 'rxjs/internal/operators/timeout';
import { ToastrService } from 'ngx-toastr';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog-service';
import { DataTable } from '../../../../shared/components';

@Component({
  selector: 'app-mesas-list',
  imports: [
    CommonModule, DataTable
  ],
  templateUrl: './mesas-list.html',
  styleUrl: './mesas-list.css',
})
export class MesasList {
  mesas = signal<Mesa[]>([]);
  isloading = signal(false);
  error = signal<string | null>(null);
  errorMessageLink = signal<string | null>(null);
  errorMessageText = signal<string | null>(null);

  constructor(private mesaService: MesaService, private router: Router, private toastr: ToastrService, private confirmDialog: ConfirmDialogService) { }
  
  ngOnInit(): void {
    this.obtenerMesas();
  }

  obtenerMesas() {
    this.isloading.set(true);
    this.error.set(null);
    this.errorMessageLink.set(null);
    this.errorMessageText.set(null);
    this.mesaService.listarMesas().pipe(timeout(10000)).subscribe({
      next: (data) => {
        this.mesas.set(data);
        this.isloading.set(false);
      },
      error: () => {
        this.isloading.set(false);
        this.error.set('Error al cargar las mesas');
      }
    });
  }

  handleAction(event: { type: string, item: Mesa }): void {
    const { type, item } = event;

    if (type === 'edit') {
      this.router.navigate(['/app/mesas/edit', item.id]);
    }

    if (type === 'delete') {
      this.eliminarMesa(item.id);
    }
  }

  eliminarMesa(id: number) {
    this.confirmDialog.confirm({
      title: 'Eliminar mesa',
      message: '¿Estás seguro de eliminar esta mesa? Esta acción no se puede deshacer.'
    }).subscribe(result => {
      if (result) {
        this.mesaService.eliminarMesa(id).subscribe({
          next: () => {
            this.mesas.update(mesas => mesas.filter(m => m.id !== id));
            this.toastr.success('Mesa eliminada correctamente');
          }
        });
      }
    });
  }
}
