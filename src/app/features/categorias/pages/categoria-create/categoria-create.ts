import { ChangeDetectorRef, Component, signal } from '@angular/core';
import { FormCard } from '../../../../shared/components/form-card/form-card';
import { InputForm } from '../../../../shared/components/input-form/input-form';
import { Select } from '../../../../shared/components/select/select';
import { CategoriaService } from '../../services/categoria-service';
import { ErrorMessage } from '../../../../shared/components/error-message/error-message';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Categoria } from '../../../../core/models/categoria';

@Component({
  selector: 'app-categoria-create',
  imports: [
    FormCard, InputForm, Select, ErrorMessage, ReactiveFormsModule, CommonModule
  ],
  templateUrl: './categoria-create.html',
  styleUrl: './categoria-create.css',
})
export class CategoriaCreate {

  form: FormGroup;
  error = signal<string | null>(null);
  loading = signal(false);
  isSubcategoria = signal(false);
  categoriasPadre = signal<Categoria[]>([]);
  categoriasPadreOptions = signal<any[]>([]);

  constructor(private categoriaService: CategoriaService, private fb: FormBuilder, private toastr: ToastrService, private router: Router) {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      descripcion: [''],
      parent_id: [null]
    });
  }

  ngOnInit() {
    this.error.set(null);
    this.loading.set(false);
    this.isSubcategoria.set(false);
    this.cargarCategoriasPadre();
  }

  cargarCategoriasPadre() {
    this.categoriaService.getCategoriasPadre().subscribe({
      next: (categorias) => {
        this.categoriasPadre.set(categorias);
        this.categoriasPadreOptions.set(
          categorias.map(c => ({
            label: c.nombre,
            value: c.id
          }))
        );
      },
      error: (err) => {
        console.error('Error al cargar categorías padre', err);
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

  private guardarCategoria(onSuccess: () => void) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    const data = this.form.value;
    
    this.categoriaService.crearCategoria(data).subscribe({
      next: () => {
        this.toastr.success('Categoría creada correctamente');
        this.error.set(null);
        this.loading.set(false);
        onSuccess();
      },
      error: (err) => {
        this.toastr.error('Error al crear categoría');
        this.loading.set(false);
        if (err.status === 0) {
          this.error.set('No se pudo conectar al servidor. Por favor, verifica tu conexión e inténtalo de nuevo.');
        } else if (err.status === 422) {
          //console.error(err);
          const errors = err?.error?.errors;
          this.error.set(Object.values(errors)
            .flat()
            .join(' | '));
        } else {
          this.error.set(err?.error?.message || 'Error al crear categoría.');
        }
      }
    });
  }

  crearCategoria() {
    this.guardarCategoria(() => {
      this.router.navigate(['/app/categorias']);
    });
  }

  guardarYagregarOtro() {
    this.guardarCategoria(() => {
      this.resetForm();
      this.cargarCategoriasPadre();
    });
  }

  cancelar() {
    this.resetForm();
    this.router.navigate(['/app/categorias']);
  }

  resetForm() {
    this.form.reset({
      nombre: '',
      descripcion: '',
      parent_id: null
    });
    this.isSubcategoria.set(false);
    this.error.set(null);
    this.loading.set(false);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }
}
