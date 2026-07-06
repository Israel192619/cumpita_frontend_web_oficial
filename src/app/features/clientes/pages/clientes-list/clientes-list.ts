import { Component, signal } from '@angular/core';
import { Cliente } from '../../../../core/models/cliente';
import { ClienteService } from '../../services/cliente-service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { timeout } from 'rxjs/internal/operators/timeout';
import { ToastrService } from 'ngx-toastr';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog-service';
import { DataTable } from '../../../../shared/components';

@Component({
  selector: 'app-clientes-list',
  imports: [
    CommonModule, DataTable
  ],
  templateUrl: './clientes-list.html',
  styleUrl: './clientes-list.css',
})
export class ClientesList {
  clientes = signal<Cliente[]>([]);
  isloading = signal(false);
  error = signal<string | null>(null);
  errorMessageLink = signal<string | null>(null);
  errorMessageText = signal<string | null>(null);

  constructor(private clienteService: ClienteService, private router: Router, private toastr: ToastrService, private confirmDialog: ConfirmDialogService) { }

  ngOnInit(): void {
    this.obtenerClientes();
  }

  obtenerClientes() {
    this.isloading.set(true);
    this.error.set(null);
    this.errorMessageLink.set(null);
    this.errorMessageText.set(null);
    this.clienteService.listarClientes().pipe(timeout(10000)).subscribe({
      next: (data) => {
        this.clientes.set(data);
        this.isloading.set(false);
      },
      error: () => {
        this.isloading.set(false);
        this.error.set('Error al cargar clientes');
      }
    });
  }

  handleAction(event: { type: string, item: Cliente }): void {
    const { type, item } = event;

    if (type === 'edit') {
      this.router.navigate(['/app/clientes/edit', item.id]);
    }

    if (type === 'view') {
      // View action
    }

    if (type === 'delete') {
      this.eliminarCliente(item.id);
    }
  }

  eliminarCliente(id: number) {
    this.confirmDialog.confirm({
      title: 'Eliminar cliente',
      message: '¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer.'
    }).subscribe(result => {
      if (result) {
        this.clienteService.eliminarCliente(id).subscribe({
          next: () => {
            this.clientes.update(clientes => clientes.filter(c => c.id !== id));
            this.toastr.success('Cliente eliminado correctamente');
          }
        });
      }
    });
  }
}

