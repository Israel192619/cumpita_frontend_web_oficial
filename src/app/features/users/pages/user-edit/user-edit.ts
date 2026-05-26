import { ChangeDetectorRef, Component, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { UserService } from '../../services/user-service';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { UpdateUser, User } from '../../../../core/models/user';
import { FormCard, InputForm, Select, ErrorMessage } from '../../../../shared/components';

@Component({
  selector: 'app-user-edit',
  imports: [
    FormCard, InputForm, Select, ErrorMessage
  ],
  templateUrl: './user-edit.html',
  styleUrl: './user-edit.css',
})
export class UserEdit {
  form: FormGroup;
  error = signal<string | null>(null);
  roles = signal<{ label: string, value: any }[]>([]);
  user = signal<User | null>(null);
  loading = signal(false);

  constructor(private fb: FormBuilder, private userService: UserService, private router: Router, private route: ActivatedRoute, private toastr: ToastrService) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      direccion: ['', Validators.required],
      numero_celular: ['', Validators.required],
      avatar: null,
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.minLength(8)]],
      role_id: [null, Validators.required]
    });
  }

  ngOnInit(): void {
    this.error.set(null);
    const id = parseInt(this.route.snapshot.paramMap.get('id')!);
    this.userService.getRoles().subscribe({
      next: (roles) => {
        this.roles.set(roles.map(role => ({ label: role.nombre, value: role.id })));
      },
      error: (err) => {
        if (err.status == 0) {
          this.error.set('No se pudo conectar al servidor. Por favor, verifica tu conexión e inténtalo de nuevo.')
        } else if (err?.staatus == 401) {
          this.error.set('No autorizado. Inicia sesión.');
        } else {
          this.error.set('Error al cargar roles.')
        }
      }
    });

    if (id) {
      this.userService.getUsuarioPorId(id).subscribe({
        next: (user) => {
          this.user.set(user);
          //console.log(user);
          this.form.patchValue({
            name: user.name,
            direccion: user.perfil_usuarios?.direccion || '',
            numero_celular: user.perfil_usuarios?.numero_celular || '',
            avatar: null,
            email: user.email,
            role_id: user.role_id
          });
        },
        error: (err) => {
          if (err.status === 0) {
            this.error.set('No se pudo conectar al servidor. Por favor, verifica tu conexión e inténtalo de nuevo.');
          } else if (err.status === 404) {
            this.error.set('Usuario no encontrado');
          } else {
            this.error.set('Error al cargar el usuario');
          }
        }
      });
    }
  }

  getControl(names: string): FormControl {
    return this.form.get(names) as FormControl;
  }

  editarUsuario() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) return;
    const id = Number(idParam);
    if (isNaN(id)) return;
    // const { password, ...rest } = this.form.value;
    // const data: UpdateUser = { ...rest };
    // if (password && password.trim() !== '') {
    //   data.password = password;
    // }
    this.error.set(null);
    const formData = new FormData();

    Object.keys(this.form.value).forEach(key => {
      const value = this.form.value[key];

      if (value !== null && value !== undefined && value !== '') {
        formData.append(key, value);
      }
    });

    if (!this.form.value.password) {
      formData.delete('password');
    }

    //console.log([...formData]);

    this.userService.editarUsuario(id, formData).subscribe({
      next: () => {
        this.toastr.success('Usuario editado correctamente');
        this.error.set(null);
        this.router.navigate(['/app/users']);
      },
      error: (err) => {
        this.toastr.error('Error al editar usuario');
        if (err.status === 0) {
          this.error.set('No se pudo conectar al servidor. Por favor, verifica tu conexión e inténtalo de nuevo.');
        } else if (err.status === 422) {
          const errors = err?.error?.errors;

          this.error.set(Object.values(errors)
            .flat()
            .join(' | '));
        } else {
          this.error.set('Error al editar usuario.');
        }
      }
    });
  }
  cancelar() {
    this.router.navigate(['/app/users']);
  }
}
