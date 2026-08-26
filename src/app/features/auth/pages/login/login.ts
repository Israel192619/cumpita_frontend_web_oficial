import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, switchMap, timeout } from 'rxjs/operators';

import { Icon, Loader } from '@app/shared/components';
import { homeForUser } from '../../../../core/auth/role-access';
import { AuthService } from '../../../../core/services/auth-service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, Icon, Loader],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly cargando = signal(false);
  readonly mensajeError = signal<string | null>(null);
  readonly mostrarContrasena = signal(false);

  // nonNullable permite obtener textos en lugar de valores string | null.
  readonly formulario = this.fb.nonNullable.group({
    identificador: [
      '',
      [
        Validators.required,
        Validators.pattern(/^(?:[^\s@]+@[^\s@]+\.[^\s@]+|[a-zA-Z0-9._-]{3,50})$/),
      ],
    ],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  /** Inicia sesión y consulta el perfil para dirigir al usuario a la pantalla de su rol. */
  enviar(): void {
    if (this.formulario.invalid || this.cargando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);

    this.auth
      .login(this.formulario.getRawValue())
      .pipe(
        timeout(15_000),
        switchMap(() => this.auth.me()),
        finalize(() => this.cargando.set(false)),
      )
      .subscribe({
        next: (usuario) => void this.router.navigateByUrl(homeForUser(usuario)),
        error: (error) => this.mensajeError.set(this.obtenerMensajeError(error)),
      });
  }

  /** Alterna la visibilidad de la contraseña sin cambiar su contenido. */
  alternarVisibilidadContrasena(): void {
    this.mostrarContrasena.update((visible) => !visible);
  }

  private obtenerMensajeError(error: any): string {
    if (error?.status === 0) {
      return 'No se pudo conectar al servidor. Verifica tu conexión e inténtalo nuevamente.';
    }
    if (error?.status === 401) return 'El correo, usuario o contraseña son incorrectos.';
    if (error?.name === 'TimeoutError') return 'El servidor tardó demasiado en responder.';

    return error?.error?.message ?? 'Ocurrió un error inesperado.';
  }
}
