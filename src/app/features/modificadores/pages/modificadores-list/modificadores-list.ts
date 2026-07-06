import { Component, signal } from '@angular/core';
import { ModificadorService, Modificador } from '../../services/modificador-service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { timeout } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog-service';
import { DataTable } from '../../../../shared/components';

@Component({
  selector: 'app-modificadores-list',
  imports: [CommonModule, DataTable],
  templateUrl: './modificadores-list.html',
  styleUrl: './modificadores-list.css',
})
export class ModificadoresList {
  modificadores = signal<Modificador[]>([]);
  isloading = signal(false);
  error = signal<string | null>(null);

  constructor(
    private modificadorService: ModificadorService,
    private router: Router,
    private toastr: ToastrService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.obtenerModificadores();
  }

  obtenerModificadores() {
    this.isloading.set(true);
    this.error.set(null);
    this.modificadorService.listarModificadores().pipe(timeout(10000)).subscribe({
      next: (data) => {
        this.modificadores.set(data);
        this.isloading.set(false);
      },
      error: (e) => {
        this.isloading.set(false);
        this.error.set('Error al cargar modificadores');
        console.error('Error al cargar modificadores:', e);
      }
    });
  }

  handleAction(event: { type: string, item: Modificador }): void {
    const { type, item } = event;

    if (type === 'edit') {
      this.router.navigate(['/app/modificadores/edit', item.id]);
    }

    if (type === 'delete') {
      this.eliminarModificador(item.id);
    }
  }

  eliminarModificador(id: number) {
    this.confirmDialog.confirm({
      title: 'Eliminar modificador',
      message: '¿Estás seguro de eliminar este modificador? Esta acción no se puede deshacer.'
    }).subscribe(result => {
      if (result) {
        this.modificadorService.eliminarModificador(id).subscribe({
          next: () => {
            this.modificadores.update(mods => mods.filter(m => m.id !== id));
            this.toastr.success('Modificador eliminado correctamente');
          }
        });
      }
    });
  }

  crearModificador() {
    this.router.navigate(['/app/modificadores/create']);
  }

  recargar() {
    this.obtenerModificadores();
  }
}
