import { Component, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ModificadorService, Modificador, UpdateModificador } from '../../services/modificador-service';
import { ToastrService } from 'ngx-toastr';
import { FormCard, InputForm, Select, ErrorMessage } from '../../../../shared/components';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modificador-edit',
  imports: [
    FormCard, InputForm, Select, ErrorMessage, ReactiveFormsModule, CommonModule
  ],
  templateUrl: './modificador-edit.html',
  styleUrl: './modificador-edit.css',
})
export class ModificadorEdit {
  form: FormGroup;
  error = signal<string | null>(null);
  loading = signal(false);
  modificador = signal<Modificador | null>(null);

  constructor(
    private fb: FormBuilder,
    private modificadorService: ModificadorService,
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService
  ) {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      tipo: ['unico', Validators.required],
      requerido: [true, Validators.required],
      activo: [true, Validators.required],
      opciones: this.fb.array([])
    });
  }

  ngOnInit() {
    this.error.set(null);
    this.loading.set(false);
    const id = parseInt(this.route.snapshot.paramMap.get('id')!);

    if (id) {
      this.cargarModificador(id);
    }
  }

  cargarModificador(id: number) {
    this.modificadorService.obtenerModificador(id).subscribe({
      next: (modificador) => {
        console.log('Modificador obtenido:', modificador);
        this.modificador.set(modificador);

        this.form.patchValue({
          nombre: modificador.nombre,
          tipo: modificador.tipo,
          requerido: modificador.requerido,
          activo: modificador.activo
        });

        // Popular opciones en FormArray
        if (modificador.opciones && modificador.opciones.length > 0) {
          this.opcionesForm.clear();
          modificador.opciones.forEach(opcion => {
            this.opcionesForm.push(
              this.fb.group({
                id: [opcion.id],
                nombre: [opcion.nombre, Validators.required],
                precio_extra: [opcion.precio_extra, [Validators.required, Validators.min(0)]],
                activo: [opcion.activo]
              })
            );
          });
        }
      }
    });
  }

  get opcionesForm(): FormArray {
    return this.form.get('opciones') as FormArray;
  }

  agregarOpcion() {
    const opcionForm = this.fb.group({
      nombre: ['', Validators.required],
      precio_extra: [0, [Validators.required, Validators.min(0)]],
      activo: [true]
    });
    this.opcionesForm.push(opcionForm);
  }

  eliminarOpcion(index: number) {
    this.opcionesForm.removeAt(index);
  }

  getOpcionControl(index: number, controlName: string): FormControl {
    return this.opcionesForm.at(index).get(controlName) as FormControl;
  }

  guardarModificador(onSuccess: () => void) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.opcionesForm.length === 0) {
      this.error.set('Debe tener al menos una opción');
      return;
    }

    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) return;

    const id = Number(idParam);
    if (isNaN(id)) return;

    this.error.set(null);
    this.loading.set(true);

    const data: UpdateModificador = this.form.value;

    this.modificadorService.actualizarModificador(id, data).subscribe({
      next: () => {
        this.toastr.success('Modificador actualizado correctamente');
        this.error.set(null);
        this.loading.set(false);
        onSuccess();
      }
    });
  }

  editarModificador() {
    this.guardarModificador(() => {
      this.router.navigate(['/app/modificadores']);
    });
  }

  cancelar() {
    this.router.navigate(['/app/modificadores']);
  }

  getControl(name: string): FormControl {
    return this.form.get(name) as FormControl;
  }
}
