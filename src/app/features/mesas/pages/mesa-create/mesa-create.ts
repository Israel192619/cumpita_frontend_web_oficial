import { Component, signal } from '@angular/core';
import { MesaService } from '../../services/mesa-service';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { ErrorMessage, FormCard, InputForm, Select } from '../../../../shared/components';

@Component({
  selector: 'app-mesa-create',
  imports: [
    FormCard, InputForm, Select, ErrorMessage, ReactiveFormsModule
  ],
  templateUrl: './mesa-create.html',
  styleUrl: './mesa-create.css',
})
export class MesaCreate {

  form: FormGroup;
  error = signal<string | null>(null);
  estadoOptions = signal<{ label: string; value: any }[]>([
    { label: 'Libre', value: 'libre' },
    { label: 'Ocupada', value: 'ocupada' },
    { label: 'Reservada', value: 'reservada' },
    { label: 'Mantenimiento', value: 'mantenimiento' }
  ]);

  constructor(private mesaService: MesaService, private fb: FormBuilder, private toastr: ToastrService, private router: Router) {
    this.form = this.fb.group({
      numero: ['', Validators.required],
      capacidad: ['', [Validators.required, Validators.min(1)]],
      estado: ['libre', Validators.required]
    });
  }

  ngOnInit() {
    this.error.set(null);
  }

  getControl(names: string): FormControl {
    return this.form.get(names) as FormControl;
  }

  private guardarMesa(onSuccess: () => void) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set(null);
    
    this.mesaService.crearMesa(this.form.value).subscribe({
      next: () => {
        this.toastr.success('Mesa creada correctamente');
        this.error.set(null);
        onSuccess();
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error al crear la mesa');
      }
    });
  }

  crearMesa() {
    this.guardarMesa(() => {
      this.router.navigate(['/app/mesas']);
    });
  }

  guardarYagregarOtra() {
    this.guardarMesa(() => {
      this.resetForm();
    });
  }

  cancelar() {
    this.resetForm();
    this.router.navigate(['/app/mesas']);
  }

  resetForm() {
    this.form.reset({
      numero: '',
      capacidad: '',
      estado: 'libre'
    });
    this.error.set(null);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }
}
