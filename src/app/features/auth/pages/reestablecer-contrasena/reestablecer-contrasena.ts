import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, timeout } from 'rxjs/operators';

import { Icon, Loader } from '@app/shared/components';
import { AuthService } from '../../../../core/services/auth-service';
import { passwordMatchValidator } from '../../../../shared/validators/confirmacion-contrasena';

@Component({
  selector: 'app-reestablecer-contrasena',
  imports: [RouterLink, ReactiveFormsModule, Icon, Loader],
  templateUrl: './reestablecer-contrasena.html',
  styleUrl: './reestablecer-contrasena.css',
})
export class ReestablecerContrasena {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly cargando = signal(false);
  readonly mensajeError = signal<string | null>(null);
  readonly mostrarContrasena = signal(false);
  readonly mostrarConfirmacion = signal(false);

  private readonly email = this.route.snapshot.queryParamMap.get('email')?.trim() ?? '';
  private readonly token = this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';
  readonly enlaceValido = Boolean(this.email && this.token);

  readonly formulario = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
    },
    { validators: passwordMatchValidator() },
  );

  constructor() {
    // El enlace enviado por correo debe contener ambos parámetros.
    if (!this.enlaceValido) {
      this.mensajeError.set('El enlace para restablecer la contraseña es inválido o está incompleto.');
    }
  }

  /** Envía la nueva contraseña junto con el token recibido en el correo. */
  enviar(): void {
    if (!this.enlaceValido) return;

    if (this.formulario.invalid || this.cargando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);
    const valores = this.formulario.getRawValue();

    this.auth
      .reestablecerContrasena({
        email: this.email,
        token: this.token,
        password: valores.password,
        password_confirmation: valores.confirmPassword,
      })
      .pipe(
        timeout(15_000),
        finalize(() => this.cargando.set(false)),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl('/login'),
        error: (error) => this.mensajeError.set(this.obtenerMensajeError(error)),
      });
  }

  alternarVisibilidadContrasena(): void {
    this.mostrarContrasena.update((visible) => !visible);
  }

  alternarVisibilidadConfirmacion(): void {
    this.mostrarConfirmacion.update((visible) => !visible);
  }

  private obtenerMensajeError(error: any): string {
    if (error?.status === 0) {
      return 'No se pudo conectar al servidor. Verifica tu conexión e inténtalo nuevamente.';
    }
    if (error?.name === 'TimeoutError') return 'El servidor tardó demasiado en responder.';

    return error?.error?.message ?? 'No se pudo restablecer la contraseña.';
  }
}
