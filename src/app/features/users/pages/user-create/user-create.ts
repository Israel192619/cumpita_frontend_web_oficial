import { ChangeDetectorRef, Component, signal } from '@angular/core';
import { UserService } from '../../services/user-service';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { ErrorMessage, FormCard, InputForm, Select } from '../../../../shared/components';

@Component({
  selector: 'app-user-create',
  imports: [
    FormCard, InputForm, Select, ErrorMessage, ReactiveFormsModule
  ],
  templateUrl: './user-create.html',
  styleUrl: './user-create.css',
})
export class UserCreate {

  form: FormGroup;
  error = signal<string | null>(null);
  roles = signal<{ label: string; value: any }[]>([]);

  constructor(private userService: UserService, private cd: ChangeDetectorRef, private fb: FormBuilder, private toastr: ToastrService, private router: Router) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      direccion: ['', Validators.required],
      numero_celular: ['', Validators.required],
      avatar: null,
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      role_id: [null, Validators.required]
    });
  }

  ngOnInit() {
    this.error.set(null);
    this.userService.getRoles().subscribe({
      next: (roles) => {
        this.roles.set(
          roles.map(role => ({ label: role.nombre, value: role.id }))
        );
      },
      error: (err) => {
        if (err.status === 0) {
          this.error.set('No se pudo conectar al servidor. Por favor, verifica tu conexión e inténtalo de nuevo.');
        } else if (err?.status === 401) {
          this.error.set('No autorizado. Inicia sesión.');
        }
        else {
          this.error.set('Error al cargar roles.');
        }
      }
    });
  }
  getControl(names: string): FormControl {
    return this.form.get(names) as FormControl;
  }
  private guardarUsuario(onSuccess: () => void) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set(null);
    const formData = new FormData();

    Object.keys(this.form.value).forEach(key => {
      const value = this.form.value[key];

      if (value !== null && value !== undefined) {
        formData.append(key, value);
      }
    });
    this.userService.crearUsuario(formData).subscribe({
      next: () => {
        this.toastr.success('Usuario creado correctamente');
        this.error.set(null);
        onSuccess();
      },
      error: (err) => {
        this.toastr.error('Error al crear usuario');
        if (err.status === 0) {
          this.error.set('No se pudo conectar al servidor. Por favor, verifica tu conexión e inténtalo de nuevo.');
        } else if (err.status === 422) {
          const errors = err?.error?.errors;

          this.error.set(Object.values(errors)
            .flat()
            .join(' | '));
        } else {
          this.error.set('Error al crear usuario.');
        }
      }
    });

  }
  crearUsuario() {
    this.guardarUsuario(() => {
      this.router.navigate(['/app/users']);
    });
  }
  guardarYagregarOtro() {
    this.guardarUsuario(() => {
      this.resetForm();
    });
  }
  cancelar() {
    this.resetForm();
    this.router.navigate(['/app/users']);
  }

  resetForm() {
    this.form.reset({
      name: '',
      email: '',
      password: '',
      role_id: null
    });
    this.error.set(null);
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  crearMultiplesUsuarios() {
    for (let index = 0; index < 5; index++) {
      this.form = this.fb.group({
        name: ['Isra', Validators.required],
        email: ['prueba@gmail.com' + index, [Validators.required, Validators.email]],
        password: ['prueba-prueba', [Validators.required, Validators.minLength(8)]],
        role_id: [1, Validators.required]
      });
      this.guardarUsuario(() => {
      });
    }
    this.router.navigate(['/app/users/list']);
  }
}
