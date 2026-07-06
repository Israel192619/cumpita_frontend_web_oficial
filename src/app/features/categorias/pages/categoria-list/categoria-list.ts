import { Component, signal } from '@angular/core';
import { Categoria } from '../../../../core/models/categoria';
import { CategoriaService } from '../../services/categoria-service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { timeout } from 'rxjs/internal/operators/timeout';
import { ToastrService } from 'ngx-toastr';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog-service';
import { Tree, TreeNode } from '../../../../shared/components/tree/tree';

@Component({
  selector: 'app-categoria-list',
  imports: [
    CommonModule, Tree
  ],
  templateUrl: './categoria-list.html',
  styleUrl: './categoria-list.css',
})
export class CategoriaList {
  categorias = signal<Categoria[]>([]);
  isloading = signal(false);
  error = signal<string | null>(null);
  errorMessageLink = signal<string | null>(null);
  errorMessageText = signal<string | null>(null);

  constructor(private categoriaService: CategoriaService, private router: Router, private toastr: ToastrService, private confirmDialog: ConfirmDialogService) { }

  ngOnInit(): void {
    this.obtenerCategorias();
  }

  obtenerCategorias() {
    this.isloading.set(true);
    this.error.set(null);
    this.errorMessageLink.set(null);
    this.errorMessageText.set(null);
    this.categoriaService.listarCategorias().pipe(timeout(10000)).subscribe({
      next: (data) => {
        //console.log('Categorías cargadas:', data);
        this.categorias.set(data);
        this.isloading.set(false);
      },
      error: () => {
        this.isloading.set(false);
        this.error.set('Error al cargar categorías');
      }
    });
  }

  handleTreeAction(event: { type: string, node: TreeNode }): void {
    const { type, node } = event;

    if (type === 'edit') {
      this.router.navigate(['/app/categorias/edit', node.id]);
    }

    if (type === 'view') {
      //this.router.navigate(['/categoria', node.id]);
    }

    if (type === 'delete') {
      this.eliminarCategoria(node.id);
    }
  }

  eliminarCategoria(id: number) {
    this.confirmDialog.confirm({
      title: 'Eliminar categoría',
      message: '¿Estás seguro de eliminar esta categoría? Esta acción no se puede deshacer.'
    }).subscribe(result => {
      if (result) {
        this.categoriaService.eliminarCategoria(id).subscribe({
          next: () => {
            this.categorias.update(categorias =>
              this.removeNode(categorias, id)
            );
            this.toastr.success('Categoría eliminada correctamente');
          }
        });
      }
    });
  }
  removeNode(data: any[], id: number): any[] {
    return data
      .filter(node => node.id !== id)
      .map(node => ({
        ...node,
        children: node.children
          ? this.removeNode(node.children, id)
          : []
      }));
  }
}
