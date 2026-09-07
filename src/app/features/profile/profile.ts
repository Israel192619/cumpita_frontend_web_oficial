import { Component, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { homeForUser } from '../../core/auth/role-access';
import { AuthService } from '../../core/services/auth-service';
import { ErrorMessage, FormCard, InputForm } from '../../shared/components';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, FormCard, InputForm, ErrorMessage],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly avatarActual = signal<string | null>(null);
  readonly form: FormGroup;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router, private toastr: ToastrService) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      username: ['', [Validators.minLength(3), Validators.pattern(/^[a-zA-Z0-9._-]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      direccion: [''], numero_celular: [''], avatar: [null as File | null],
      password: ['', Validators.minLength(8)],
    });
    const cached = this.auth.usuarioGuardado();
    if (cached) this.cargar(cached);
    this.auth.me().subscribe({ next: user => this.cargar(user), error: () => this.error.set('No se pudo cargar tu perfil.') });
  }

  getControl(name: string): FormControl { return this.form.get(name) as FormControl; }

  guardar(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true); this.error.set(null);
    const data = new FormData();
    Object.entries(this.form.getRawValue()).forEach(([key, value]) => {
      if (value !== null && value !== '') data.append(key, value instanceof File ? value : String(value));
    });
    this.auth.actualizarPerfil(data).subscribe({
      next: user => {
        this.loading.set(false);
        this.cargar(user);
        this.toastr.success('Perfil actualizado correctamente');
        this.router.navigateByUrl(homeForUser(user));
      },
      error: err => { this.loading.set(false); this.error.set(err.error?.message || 'No se pudo actualizar el perfil.'); }
    });
  }

  cancelar(): void { const user = this.auth.usuarioGuardado(); this.router.navigateByUrl(user ? homeForUser(user) : '/login'); }

  private cargar(user: any): void {
    this.avatarActual.set(user.perfil_usuarios?.avatar_url ?? null);
    this.form.patchValue({ name: user.name, username: user.username ?? '', email: user.email, direccion: user.perfil_usuarios?.direccion ?? '', numero_celular: user.perfil_usuarios?.numero_celular ?? '', password: '' });
  }
}
