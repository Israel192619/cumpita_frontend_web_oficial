import { Component, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModificadorService, CreateModificador } from '../../services/modificador-service';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { FormCard, InputForm, Select, ErrorMessage, Icon } from '../../../../shared/components';
import { CommonModule } from '@angular/common';
import { EstacionTrabajoService } from '../../../estaciones/services/estacion-trabajo-service';
import { EstacionTrabajo } from '../../../../core/models/estacion-trabajo';
import { CURRENCY_CONFIG } from '@app/core/config/currency.config';

@Component({
  selector: 'app-modificador-create',
  imports: [
    FormCard, InputForm, Select, ErrorMessage, ReactiveFormsModule, CommonModule, Icon
  ],
  templateUrl: './modificador-create.html',
  styleUrl: './modificador-create.css',
})
export class ModificadorCreate {
  readonly currencySymbol = CURRENCY_CONFIG.symbol;
  form: FormGroup;
  error = signal<string | null>(null);
  loading = signal(false);
  estaciones = signal<EstacionTrabajo[]>([]);

  constructor(
    private fb: FormBuilder,
    private modificadorService: ModificadorService,
    private estacionService: EstacionTrabajoService,
    private toastr: ToastrService,
    private router: Router
  ) {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      tipo: ['unico', Validators.required],
      requerido: [true, Validators.required],
      activo: [true, Validators.required],
      estacion_id: [null],
      opciones: this.fb.array([])
    });
  }

  ngOnInit() {
    this.error.set(null);
    this.loading.set(false);
    this.agregarOpcion();
    this.cargarEstaciones();
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
    if (this.opcionesForm.length === 1) return;
    this.opcionesForm.removeAt(index);
  }

  cargarEstaciones() {
    this.estacionService.listar().subscribe({
      next: estaciones => this.estaciones.set(estaciones),
      error: () => this.error.set('No se pudieron cargar las estaciones de trabajo.'),
    });
  }

  get estacionOptions() {
    return [
      { label: 'Sin estación', value: null },
      ...this.estaciones().map(estacion => ({
        label: `${estacion.nombre} (${estacion.codigo})${estacion.activa ? '' : ' — Inactiva'}`,
        value: estacion.id,
      })),
    ];
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
      },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'No se pudo crear el modificador.');
      },
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
      activo: true,
      estacion_id: null,
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
