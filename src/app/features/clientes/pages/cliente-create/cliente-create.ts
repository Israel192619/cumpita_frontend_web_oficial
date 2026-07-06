import { Component, signal } from '@angular/core';
import { ClienteService } from '../../services/cliente-service';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { ErrorMessage, FormCard, InputForm } from '../../../../shared/components';

@Component({
  selector: 'app-cliente-create',
  imports: [
    FormCard, InputForm, ErrorMessage, ReactiveFormsModule
  ],
  templateUrl: './cliente-create.html',
  styleUrl: './cliente-create.css',
})
export class ClienteCreate {

  form: FormGroup;
  error = signal<string | null>(null);
  isloading = signal(false);

  constructor(private clienteService: ClienteService, private fb: FormBuilder, private toastr: ToastrService, private router: Router) {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      telefono: ['', []],
    });
  }

  ngOnInit() {
    this.error.set(null);
  }

  getControl(names: string): FormControl {
    return this.form.get(names) as FormControl;
  }

  private guardarCliente(onSuccess: () => void) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isloading.set(true);
    this.error.set(null);

    this.clienteService.crearCliente(this.form.value).subscribe({
      next: () => {
        this.toastr.success('Cliente creado correctamente');
        this.error.set(null);
        onSuccess();
      },
      error: (err) => {
        this.isloading.set(false);
        this.error.set('Error al crear cliente');
      }
    });
  }

  crearCliente() {
    this.guardarCliente(() => {
      this.router.navigate(['/app/clientes']);
    });
  }

  guardarYagregarOtro() {
    this.guardarCliente(() => {
      this.resetForm();
    });
  }

  cancelar() {
    this.resetForm();
    this.router.navigate(['/app/clientes']);
  }

  resetForm() {
    this.form.reset({
      nombre: '',
      telefono: ''
    });
    this.error.set(null);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }
}

