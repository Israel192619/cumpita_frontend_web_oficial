import { Component, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ClienteService } from '../../services/cliente-service';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Cliente } from '../../../../core/models/cliente';
import { FormCard, InputForm, ErrorMessage } from '../../../../shared/components';

@Component({
  selector: 'app-cliente-edit',
  imports: [
    FormCard, InputForm, ErrorMessage, ReactiveFormsModule
  ],
  templateUrl: './cliente-edit.html',
  styleUrl: './cliente-edit.css',
})
export class ClienteEdit {
  form: FormGroup;
  error = signal<string | null>(null);
  cliente = signal<Cliente | null>(null);
  loading = signal(false);

  constructor(private fb: FormBuilder, private clienteService: ClienteService, private router: Router, private route: ActivatedRoute, private toastr: ToastrService) {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      telefono: ['', []],
    });
  }

  ngOnInit(): void {
    this.error.set(null);
    const id = parseInt(this.route.snapshot.paramMap.get('id')!);
    
    if (id) {
      this.clienteService.getClientePorId(id).subscribe({
        next: (cliente) => {
          this.cliente.set(cliente);
          this.form.patchValue({
            nombre: cliente.nombre,
            telefono: cliente.telefono || ''
          });
        },
        error: () => {
          this.error.set('Error al cargar el cliente');
        }
      });
    }
  }

  getControl(names: string): FormControl {
    return this.form.get(names) as FormControl;
  }

  editarCliente() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) return;
    const id = Number(idParam);
    if (isNaN(id)) return;

    this.error.set(null);
    this.loading.set(true);

    this.clienteService.editarCliente(id, this.form.value).subscribe({
      next: () => {
        this.toastr.success('Cliente editado correctamente');
        this.router.navigate(['/app/clientes']);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Error al editar el cliente');
      }
    });
  }

  cancelar() {
    this.router.navigate(['/app/clientes']);
  }
}

