import { Component, signal } from '@angular/core';
import { UserService } from '../../services/user-service';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { ErrorMessage, FormCard, InputForm, Select } from '../../../../shared/components';
import { EstacionTrabajoService } from '../../../estaciones/services/estacion-trabajo-service';

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
  estaciones = signal<{ label: string; value: number | null }[]>([]);
  private todasEstaciones: { id: number; nombre: string; codigo: string; activa: boolean }[] = [];
  isloading = signal(false);

  constructor(
    private userService: UserService,
    private estacionTrabajoService: EstacionTrabajoService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private router: Router
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]{3,50}$/)]],
      direccion: ['', Validators.required],
      numero_celular: ['', Validators.required],
      avatar: null,
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      pin: ['', [Validators.pattern(/^\d{4,6}$/)]],
      role_id: [null, Validators.required],
      estacion_id: [null]
    });
  }

  ngOnInit() {
    this.error.set(null);
    this.userService.getRoles().subscribe({
      next: (roles) => {
        this.roles.set(
          roles.map(role => ({ label: role.nombre, value: role.id }))
        );
        this.ajustarEstacionesAlRol();
      }
    });
    this.form.get('role_id')?.valueChanges.subscribe(() => this.ajustarEstacionesAlRol());
    this.cargarEstaciones();
  }

  cargarEstaciones() {
    this.estacionTrabajoService.listar().subscribe({
      next: (estaciones) => {
        this.todasEstaciones = estaciones.filter(est => est.activa && est.codigo !== 'BEBIDAS');
        this.ajustarEstacionesAlRol();
      }
    });
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
  private guardarUsuario(onSuccess: () => void) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isloading.set(true);
    this.error.set(null);
    const formData = new FormData();
    const values = this.form.value;

    Object.keys(values).forEach(key => {
      const value = values[key];

      if (key === 'estacion_id') {
        if (value !== undefined && value !== null) {
          formData.append('estacion_id', value);
        }
        return;
      }

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
        this.isloading.set(false);
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
      username: '',
      email: '',
      password: '',
      pin: '',
      role_id: null,
      estacion_id: null
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
