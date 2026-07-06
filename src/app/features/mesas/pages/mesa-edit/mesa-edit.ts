import { Component, signal } from '@angular/core';
import { MesaService } from '../../services/mesa-service';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Router, ActivatedRoute } from '@angular/router';
import { ErrorMessage, FormCard, InputForm, Select } from '../../../../shared/components';

@Component({
  selector: 'app-mesa-edit',
  imports: [
    FormCard, InputForm, Select, ErrorMessage, ReactiveFormsModule
  ],
  templateUrl: './mesa-edit.html',
  styleUrl: './mesa-edit.css',
})
export class MesaEdit {

  form: FormGroup;
  error = signal<string | null>(null);
  loading = signal(false);
  mesaId: number | null = null;
  estadoOptions = signal<{ label: string; value: any }[]>([
    { label: 'Libre', value: 'libre' },
    { label: 'Ocupada', value: 'ocupada' },
    { label: 'Reservada', value: 'reservada' },
    { label: 'Mantenimiento', value: 'mantenimiento' }
  ]);

  constructor(
    private mesaService: MesaService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      numero: ['', Validators.required],
      capacidad: ['', [Validators.required, Validators.min(1)]],
      estado: ['libre', Validators.required]
    });
  }

  ngOnInit() {
    this.error.set(null);
    this.route.params.subscribe(params => {
      this.mesaId = params['id'];
      if (this.mesaId) {
        this.cargarMesa(this.mesaId);
      }
    });
  }

  cargarMesa(id: number) {
    this.loading.set(true);
    this.mesaService.getMesaPorId(id).subscribe({
      next: (mesa) => {
        this.form.patchValue({
          numero: mesa.numero,
          capacidad: mesa.capacidad,
          estado: mesa.estado
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Error al cargar la mesa');
      }
    });
  }

  getControl(names: string): FormControl {
    return this.form.get(names) as FormControl;
  }

  editarMesa() {
    if (this.form.invalid || !this.mesaId) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set(null);
    
    this.mesaService.editarMesa(this.mesaId, this.form.value).subscribe({
      next: () => {
        this.toastr.success('Mesa actualizada correctamente');
        this.error.set(null);
        this.router.navigate(['/app/mesas']);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error al actualizar la mesa');
      }
    });
  }

  cancelar() {
    this.router.navigate(['/app/mesas']);
  }
}
