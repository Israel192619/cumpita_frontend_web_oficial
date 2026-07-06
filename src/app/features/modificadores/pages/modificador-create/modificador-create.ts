import { Component, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModificadorService, CreateModificador } from '../../services/modificador-service';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { FormCard, InputForm, Select, ErrorMessage } from '../../../../shared/components';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modificador-create',
  imports: [
    FormCard, InputForm, Select, ErrorMessage, ReactiveFormsModule, CommonModule
  ],
  templateUrl: './modificador-create.html',
  styleUrl: './modificador-create.css',
})
export class ModificadorCreate {
  form: FormGroup;
  error = signal<string | null>(null);
  loading = signal(false);

  constructor(
    private fb: FormBuilder,
    private modificadorService: ModificadorService,
    private toastr: ToastrService,
    private router: Router
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
    this.agregarOpcion();
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
      this.error.set('Debe agregar al menos una opción');
      return;
    }

    this.error.set(null);
    this.loading.set(true);

    const data: CreateModificador = this.form.value;

    this.modificadorService.crearModificador(data).subscribe({
      next: () => {
        this.toastr.success('Modificador creado correctamente');
        this.error.set(null);
        this.loading.set(false);
        onSuccess();
      }
    });
  }

  crearModificador() {
    this.guardarModificador(() => {
      this.router.navigate(['/app/modificadores']);
    });
  }

  guardarYagregarOtro() {
    this.guardarModificador(() => {
      this.resetForm();
    });
  }

  cancelar() {
    this.resetForm();
    this.router.navigate(['/app/modificadores']);
  }

  resetForm() {
    this.form.reset({
      nombre: '',
      tipo: 'unico',
      requerido: true,
      activo: true
    });
    this.opcionesForm.clear();
    this.agregarOpcion();
    this.error.set(null);
    this.loading.set(false);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  getControl(name: string): FormControl {
    return this.form.get(name) as FormControl;
  }
}
