import { Component, computed, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ErrorMessage, FormCard, InputForm } from '../../../../shared/components';
import { Producto } from '../../../../core/models/producto';
import { ProductoService, TipoAjusteStock } from '../../services/producto-service';

@Component({
  selector: 'app-ajuste-stock-create',
  imports: [ReactiveFormsModule, FormCard, InputForm, ErrorMessage],
  templateUrl: './ajuste-stock-create.html',
  styleUrl: './ajuste-stock-create.css',
})
export class AjusteStockCreate {
  productos = signal<Producto[]>([]);
  loading = signal(false);
  loadingProducts = signal(true);
  error = signal<string | null>(null);
  form: FormGroup;
  readonly tipo = computed(() => this.form.get('tipo')?.value as TipoAjusteStock);

  constructor(private fb: FormBuilder, private service: ProductoService, private router: Router, private toastr: ToastrService) {
    this.form = this.fb.group({
      producto_id: [null as number | null, Validators.required],
      tipo: ['ENTRADA' as TipoAjusteStock, Validators.required],
      cantidad: [1, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
      motivo: ['', [Validators.maxLength(255)]],
    });
  }

  ngOnInit(): void {
    this.service.listarProductos().subscribe({
      next: productos => { this.productos.set(productos.filter(producto => producto.maneja_stock && producto.stock != null)); this.loadingProducts.set(false); },
      error: () => { this.error.set('No se pudieron cargar los productos con stock.'); this.loadingProducts.set(false); },
    });
    this.control('tipo').valueChanges.subscribe(tipo => {
      const quantity = this.control('cantidad');
      quantity.setValidators([Validators.required, Validators.min(tipo === 'CORRECCION' ? 0 : 1), Validators.pattern(/^\d+$/)]);
      quantity.updateValueAndValidity();
    });
  }

  control(name: string): FormControl { return this.form.get(name) as FormControl; }
  labelCantidad(): string { return this.tipo() === 'CORRECCION' ? 'Nuevo stock contado' : 'Cantidad'; }
  ayudaCantidad(): string {
    if (this.tipo() === 'CORRECCION') return 'Indica el stock final que realmente contaste.';
    return this.tipo() === 'SALIDA' ? 'Se descontará del stock disponible.' : 'Se sumará al stock disponible.';
  }

  guardar(): void {
    if (this.form.invalid || this.loading()) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set(null);
    this.service.crearAjusteStock(this.form.getRawValue()).subscribe({
      next: () => { this.toastr.success('Ajuste de stock registrado.'); this.router.navigate(['/app/ajustes-stock']); },
      error: err => { this.error.set(err?.error?.message || Object.values(err?.error?.errors ?? {}).flat().join(' ') || 'No se pudo registrar el ajuste.'); this.loading.set(false); },
    });
  }

  cancelar(): void { this.router.navigate(['/app/ajustes-stock']); }
}
