import { Component, signal } from '@angular/core';
import { FormCard } from '../../../../shared/components/form-card/form-card';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { InputForm } from '../../../../shared/components/input-form/input-form';
import { Select } from '../../../../shared/components/select/select';
import { CategoriaService } from '../../services/categoria-service';
import { ErrorMessage } from '../../../../shared/components/error-message/error-message';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Categoria, UpdateCategoria } from '../../../../core/models/categoria';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-categoria-edit',
  imports: [
    FormCard, InputForm, Select, ErrorMessage, CommonModule
  ],
  templateUrl: './categoria-edit.html',
  styleUrl: './categoria-edit.css',
})
export class CategoriaEdit {
  form: FormGroup;
  error: string | null = null;
  categoria: Categoria | null = null;
  isSubcategoria = signal(false);
  categoriasPadre = signal<Categoria[]>([]);
  categoriasPadreOptions = signal<any[]>([]);

  constructor(private fb: FormBuilder, private categoriaService: CategoriaService, private router: Router, private route: ActivatedRoute, private toastr: ToastrService) {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      descripcion: ['', ],
      parent_id: [null]
    });
  }

  ngOnInit(): void {
    this.error = null;
    const id = parseInt(this.route.snapshot.paramMap.get('id')!);

    if (id) {
      this.cargarCategoria(id);
      this.cargarCategoriasPadre();
    }
  }

  cargarCategoria(id: number) {
    this.categoriaService.getCategoriaPorId(id).subscribe({
      next: (categoria) => {
        this.categoria = categoria;
        
        const esSubcategoria = !!categoria.parent_id;
        this.isSubcategoria.set(esSubcategoria);

        this.form.patchValue({
          nombre: categoria.nombre,
          descripcion: categoria.descripcion || '',
          parent_id: categoria.parent_id || null
        });
      }
    });
  }

  cargarCategoriasPadre() {
    this.categoriaService.getCategoriasPadre().subscribe({
      next: (categorias) => {
        const id = this.categoria?.id;
        const categoriasFiltradas = categorias.filter(c => c.id !== id);
        this.categoriasPadre.set(categoriasFiltradas);
        this.categoriasPadreOptions.set(
          categoriasFiltradas.map(c => ({
            label: c.nombre,
            value: c.id
          }))
        );
      }
    });
  }

  onIsSubcategoriaChange() {
    if (!this.isSubcategoria()) {
      this.form.patchValue({ parent_id: null });
      this.form.get('parent_id')?.clearAsyncValidators();
    }
  }

  getControl(names: string): FormControl {
    return this.form.get(names) as FormControl;
  }

  editarCategoria() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) return;
    const id = Number(idParam);
    if (isNaN(id)) return;
    
    this.error = null;
    const data: UpdateCategoria = this.form.value;

    this.categoriaService.editarCategoria(id, data).subscribe({
      next: () => {
        this.toastr.success('Categoría editada correctamente');
        this.error = null;
        this.router.navigate(['/app/categorias']);
      }
    });
  }

  cancelar() {
    this.router.navigate(['/app/categorias']);
  }
}
