import { Component, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService } from '../../services/user-service';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { User } from '../../../../core/models/user';
import { FormCard, InputForm, Select, ErrorMessage } from '../../../../shared/components';
import { EstacionTrabajoService } from '../../../estaciones/services/estacion-trabajo-service';

@Component({
  selector: 'app-user-edit',
  imports: [
    FormCard, InputForm, Select, ErrorMessage, ReactiveFormsModule
  ],
  templateUrl: './user-edit.html',
  styleUrl: './user-edit.css',
})
export class UserEdit {
  form: FormGroup;
  error = signal<string | null>(null);
  roles = signal<{ label: string, value: any }[]>([]);
  estaciones = signal<{ label: string; value: number | null }[]>([]);
  private todasEstaciones: { id: number; nombre: string; codigo: string; activa: boolean }[] = [];
  user = signal<User | null>(null);
  loading = signal(false);
  removeAvatar = signal(false);

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private estacionTrabajoService: EstacionTrabajoService,
    private router: Router,
    private route: ActivatedRoute,
    private toastr: ToastrService
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]{3,50}$/)]],
      direccion: ['', Validators.required],
      numero_celular: ['', Validators.required],
      avatar: null,
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.minLength(8)]],
      pin: ['', [Validators.pattern(/^\d{4,6}$/)]],
      role_id: [null, Validators.required],
      estacion_id: [null]
    });
    this.form.get('role_id')?.valueChanges.subscribe(() => this.ajustarEstacionesAlRol());
  }

  ngOnInit(): void {
    this.error.set(null);
    const id = parseInt(this.route.snapshot.paramMap.get('id')!);
    
    this.userService.getRoles().subscribe({
      next: (roles) => {
        this.roles.set(roles.map(role => ({ label: role.nombre, value: role.id })));
        this.ajustarEstacionesAlRol();
      }
    });

    this.estacionTrabajoService.listar().subscribe({
      next: (estaciones) => {
        this.todasEstaciones = estaciones.filter(est => est.activa && est.codigo !== 'BEBIDAS');
        this.ajustarEstacionesAlRol();
      }
    });

    if (id) {
      this.userService.getUsuarioPorId(id).subscribe({
        next: (user) => {
          this.user.set(user);
          this.form.patchValue({
            name: user.name,
            username: user.username ?? '',
            direccion: user.perfil_usuarios?.direccion || '',
            numero_celular: user.perfil_usuarios?.numero_celular || '',
            avatar: null,
            email: user.email,
            role_id: user.role_id,
            estacion_id: user.estacion_id ?? null
          });
        }
      });
    }
  }

  getControl(names: string): FormControl {
    return this.form.get(names) as FormControl;
  }
  esRolMesero(): boolean {
    const roleId = Number(this.form.get('role_id')?.value);
    return this.roles().some(role => Number(role.value) === roleId && role.label.trim().toLowerCase() === 'mesero');
  }
  esRolCocinero(): boolean { return this.nombreRol() === 'cocinero'; }
  estacionAutomatica(): string { return this.esRolMesero() ? 'Meseros' : ''; }
  private nombreRol(): string {
    const roleId = Number(this.form.get('role_id')?.value);
    return this.roles().find(role => Number(role.value) === roleId)?.label.trim().toLowerCase() ?? '';
  }
  private ajustarEstacionesAlRol(): void {
    const rol = this.nombreRol();
    const control = this.form.get('estacion_id');
    if (rol === 'mesero') {
      const estacion = this.todasEstaciones.find(item => item.codigo === 'MESEROS');
      this.estaciones.set(estacion ? [{ label: estacion.nombre, value: estacion.id }] : []);
      control?.setValue(estacion?.id ?? null, { emitEvent: false });
    } else if (rol === 'cocinero') {
      const permitidas = this.todasEstaciones.filter(item => ['COCINA', 'PARRILLA'].includes(item.codigo));
      this.estaciones.set(permitidas.map(item => ({ label: `${item.nombre} (${item.codigo})`, value: item.id })));
      if (!permitidas.some(item => item.id === Number(control?.value))) control?.setValue(null, { emitEvent: false });
    } else {
      this.estaciones.set([]);
      control?.setValue(null, { emitEvent: false });
    }
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
    const values = this.form.value;

    Object.keys(values).forEach(key => {
      const value = values[key];

      if (key === 'estacion_id') {
        if (value !== undefined) {
          formData.append('estacion_id', value ?? '');
        }
        return;
      }

      if (value !== null && value !== undefined && value !== '') {
        formData.append(key, value);
      }
    });

    if (!this.form.value.password) {
      formData.delete('password');
    }
    if (!this.form.value.pin) {
      formData.delete('pin');
    }
    if (this.removeAvatar()) {
      formData.append('remove_avatar', '1');
    }

    //console.log([...formData]);

    this.userService.editarUsuario(id, formData).subscribe({
      next: () => {
        this.toastr.success('Usuario editado correctamente');
        this.error.set(null);
        this.router.navigate(['/app/users']);
      }
    });
  }
  quitarAvatar(): void { this.removeAvatar.set(true); }
  seleccionarAvatar(): void { this.removeAvatar.set(false); }
  cancelar() {
    this.router.navigate(['/app/users']);
  }
}
