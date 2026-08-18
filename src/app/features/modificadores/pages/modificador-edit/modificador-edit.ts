import { Component, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ModificadorService, Modificador, UpdateModificador } from '../../services/modificador-service';
import { ToastrService } from 'ngx-toastr';
import { FormCard, InputForm, Select, ErrorMessage, Icon } from '../../../../shared/components';
import { CommonModule } from '@angular/common';
import { EstacionTrabajoService } from '../../../estaciones/services/estacion-trabajo-service';
import { EstacionTrabajo } from '../../../../core/models/estacion-trabajo';
import { CURRENCY_CONFIG } from '@app/core/config/currency.config';

@Component({
  selector: 'app-modificador-edit',
  imports: [
    FormCard, InputForm, Select, ErrorMessage, ReactiveFormsModule, CommonModule, Icon
  ],
  templateUrl: './modificador-edit.html',
  styleUrl: './modificador-edit.css',
})
export class ModificadorEdit {
  readonly currencySymbol = CURRENCY_CONFIG.symbol;
  form: FormGroup;
  error = signal<string | null>(null);
  loading = signal(false);
  modificador = signal<Modificador | null>(null);
  estaciones = signal<EstacionTrabajo[]>([]);

  constructor(
    private fb: FormBuilder,
    private modificadorService: ModificadorService,
    private estacionService: EstacionTrabajoService,
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService
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
    this.cargarEstaciones();
    const id = parseInt(this.route.snapshot.paramMap.get('id')!);

    if (id) {
      this.cargarModificador(id);
    }
  }

  cargarModificador(id: number) {
    this.modificadorService.obtenerModificador(id).subscribe({
      next: (modificador) => {
        this.modificador.set(modificador);

        this.form.patchValue({
          nombre: modificador.nombre,
          tipo: modificador.tipo,
          requerido: modificador.requerido,
          activo: modificador.activo,
          estacion_id: modificador.estacion_id ?? null,
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
      },
      error: err => this.error.set(err?.error?.message || 'No se pudo cargar el modificador.'),
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
      },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'No se pudo actualizar el modificador.');
      },
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
