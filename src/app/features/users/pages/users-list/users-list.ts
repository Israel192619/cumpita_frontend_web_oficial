import { Component, signal } from '@angular/core';
import { User } from '../../../../core/models/user';
import { UserService } from '../../services/user-service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { timeout } from 'rxjs/internal/operators/timeout';
import { ToastrService } from 'ngx-toastr';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog-service';
import { DataTable } from '../../../../shared/components';

@Component({
  selector: 'app-users-list',
  imports: [
    CommonModule, DataTable
  ],
  templateUrl: './users-list.html',
  styleUrl: './users-list.css',
})
export class UsersList {
  users = signal<User[]>([]);
  isloading = signal(false);
  error = signal<string | null>(null);
  showDeleteModal = false;
  errorMessageLink = signal<string | null>(null);
  errorMessageText = signal<string | null>(null);

  constructor(private userService: UserService, private router: Router, private toastr: ToastrService, private confirmDialog: ConfirmDialogService) { }
  ngOnInit(): void {
    this.obtenerUsuarios();
  }

  obtenerUsuarios() {
    this.isloading.set(true);
    this.error.set(null);
    this.errorMessageLink.set(null);
    this.errorMessageText.set(null);
    this.userService.listarUsuarios().pipe(timeout(10000)).subscribe({
      next: (data) => {
        this.users.set(data);
        this.isloading.set(false);
      },
      error: () => {
        this.isloading.set(false);
        this.error.set('Error al cargar usuarios');
      }
    });
  }

  handleAction(event: { type: string, item: User }): void {
    const { type, item } = event;

    if (type === 'edit') {
      this.router.navigate(['/app/users/edit', item.id]);
    }

    if (type === 'view') {
      //this.router.navigate(['/user', item.id]);
    }

    if (type === 'delete') {
      this.eliminarUsuario(item.id);
    }
  }

  eliminarUsuario(id: number) {
    this.confirmDialog.confirm({
      title: 'Eliminar usuario',
      message: '¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.'
    }).subscribe(result => {
      if (result) {
        this.userService.eliminarUsuario(id).subscribe({
          next: () => {
            this.users.update(users => users.filter(u => u.id !== id));
            this.toastr.success('Usuario eliminado correctamente');
          }
        });
      }
    });
  }
}
