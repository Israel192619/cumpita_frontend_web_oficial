import { Component, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ErrorMessage, FormCard, InputForm } from '../../../../shared/components';
import { MovimientoService } from '../../services/movimiento-service';

@Component({
  selector: 'app-movimiento-create',
  imports: [ReactiveFormsModule, FormCard, InputForm, ErrorMessage],
  templateUrl: './movimiento-create.html',
  styleUrl: './movimiento-create.css',
})
export class MovimientoCreate {
  loading = signal(false);
  error = signal<string | null>(null);
  form: FormGroup;

  constructor(private fb: FormBuilder, private service: MovimientoService, private router: Router, private toastr: ToastrService) {
    this.form = this.fb.group({
      tipo: ['INGRESO' as 'INGRESO' | 'RETIRO', Validators.required],
      monto: [null as number | null, [Validators.required, Validators.min(0.01)]],
      motivo: ['', [Validators.required, Validators.maxLength(255)]],
    });
  }

  control(name: string) { return this.form.get(name) as FormControl; }

  guardar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set(null);
    this.service.crear(this.form.getRawValue() as any).subscribe({
      next: () => { this.toastr.success('Movimiento registrado correctamente.'); this.router.navigate(['/app/movimientos-caja']); },
      error: err => { this.error.set(err?.error?.message || Object.values(err?.error?.errors ?? {}).flat().join(' ') || 'No se pudo registrar el movimiento.'); this.loading.set(false); },
    });
  }

  cancelar() { this.router.navigate(['/app/movimientos-caja']); }

}
