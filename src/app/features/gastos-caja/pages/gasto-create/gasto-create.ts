import { Component, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ErrorMessage, FormCard, InputForm, Select } from '../../../../shared/components';
import { CATEGORIAS_GASTO, CrearGasto, GastoCajaService } from '../../services/gasto-caja-service';
import { CURRENCY_CONFIG } from '@app/core/config/currency.config';

@Component({
  selector: 'app-gasto-create',
  imports: [ReactiveFormsModule, FormCard, InputForm, Select, ErrorMessage],
  templateUrl: './gasto-create.html',
  styleUrl: './gasto-create.css',
})
export class GastoCreate {
  readonly currencySymbol = CURRENCY_CONFIG.symbol;
  loading = signal(false);
  error = signal<string | null>(null);
  categorias = CATEGORIAS_GASTO;
  categoriaOptions = CATEGORIAS_GASTO.map(categoria => ({ label: categoria, value: categoria }));
  form: FormGroup;

  constructor(private fb: FormBuilder, private service: GastoCajaService, private router: Router, private toastr: ToastrService) {
    this.form = this.fb.group({
      categoria: ['INSUMOS', Validators.required],
      concepto: ['', [Validators.required, Validators.maxLength(255)]],
      monto: [null as number | null, [Validators.required, Validators.min(0.01)]],
    });
  }

  control(name: string) { return this.form.get(name) as FormControl; }

  guardar() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set(null);
    this.service.crear(this.form.getRawValue() as CrearGasto).subscribe({
      next: () => {
        this.toastr.success('Gasto registrado correctamente.');
        this.router.navigate(['/app/gastos-caja']);
      },
      error: error => {
        this.error.set(error?.error?.message || Object.values(error?.error?.errors ?? {}).flat().join(' ') || 'No se pudo registrar el gasto.');
        this.loading.set(false);
      },
    });
  }

  cancelar() { this.router.navigate(['/app/gastos-caja']); }
}
