import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { EstacionTrabajo } from '../../../../core/models/estacion-trabajo';
import { EstacionTrabajoPayload } from '../../../../core/models/estacion-trabajo';
import { EstacionTrabajoService } from '../../services/estacion-trabajo-service';

@Component({
  selector: 'app-estaciones-list',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './estaciones-list.html',
  styleUrl: './estaciones-list.css',
})
export class EstacionesList {
  estaciones = signal<EstacionTrabajo[]>([]);
  editandoId = signal<number | null>(null);
  cargando = signal(false);
  form;

  constructor(
    private fb: FormBuilder,
    private estacionesService: EstacionTrabajoService,
    private toastr: ToastrService,
  ) {
    this.form = this.fb.nonNullable.group({
      nombre: ['', Validators.required],
      codigo: ['', Validators.required],
      descripcion: [''],
      activa: true,
      orden: [0, [Validators.required, Validators.min(0)]],
    });
  }

  ngOnInit() { this.cargar(); }

  cargar() {
    this.estacionesService.listar().subscribe({ next: estaciones => this.estaciones.set(estaciones) });
  }

  guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    const valor = this.form.getRawValue();
    const datos: EstacionTrabajoPayload = {
      ...valor,
      codigo: valor.codigo.trim().toUpperCase(),
    };
    const id = this.editandoId();
    const solicitud = id
      ? this.estacionesService.actualizar(id, datos)
      : this.estacionesService.crear(datos);
    solicitud.subscribe({
      next: () => {
        this.toastr.success(id ? 'Estación actualizada.' : 'Estación creada.');
        this.cancelarEdicion();
        this.cargar();
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  editar(estacion: EstacionTrabajo) {
    this.editandoId.set(estacion.id);
    this.form.patchValue({
      nombre: estacion.nombre,
      codigo: estacion.codigo,
      descripcion: estacion.descripcion ?? '',
      activa: estacion.activa,
      orden: estacion.orden,
    });
  }

  cancelarEdicion() {
    this.editandoId.set(null);
    this.form.reset({ nombre: '', codigo: '', descripcion: '', activa: true, orden: 0 });
  }
}
