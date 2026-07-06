import { Component, signal } from '@angular/core';
import { Producto } from '../../../../core/models/producto';
import { ProductoService } from '../../services/producto-service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { timeout } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog-service';
import { DataTable } from '../../../../shared/components';

@Component({
  selector: 'app-productos-list',
  imports: [CommonModule, DataTable],
  templateUrl: './productos-list.html',
  styleUrl: './productos-list.css',
})
export class ProductosList {
  productos = signal<Producto[]>([]);
  isloading = signal(false);
  error = signal<string | null>(null);

  constructor(
    private productoService: ProductoService,
    private router: Router,
    private toastr: ToastrService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.obtenerProductos();
  }

  obtenerProductos(categoriaId?: number): void {
    this.isloading.set(true);
    this.error.set(null);

    this.productoService
      .listarProductos(categoriaId)
      .pipe(timeout(10000))
      .subscribe({
        next: (data) => {
          this.productos.set(data);
          this.isloading.set(false);
        },
        error: () => {
          this.isloading.set(false);
          this.error.set('Error al cargar productos');
        }
      });
  }

  handleAction(event: { type: string, item: Producto }): void {
    const { type, item } = event;

    if (type === 'edit') {
      this.router.navigate(['/app/productos/edit', item.id]);
    }

    if (type === 'delete') {
      this.eliminarProducto(item.id);
    }
  }

  eliminarProducto(id: number) {
    this.confirmDialog.confirm({
      title: 'Eliminar producto',
      message: '¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.'
    }).subscribe(result => {
      if (result) {
        this.productoService.eliminarProducto(id).subscribe({
          next: () => {
            this.productos.update(prods => prods.filter(p => p.id !== id));
            this.toastr.success('Producto eliminado correctamente');
          }
        });
      }
    });
  }

  crearProducto() {
    this.router.navigate(['/app/productos/create']);
  }

  recargar() {
    this.obtenerProductos();
  }
}

