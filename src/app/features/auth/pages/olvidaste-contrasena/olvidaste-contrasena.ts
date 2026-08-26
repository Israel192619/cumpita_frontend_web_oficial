import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, timeout } from 'rxjs/operators';

import { Loader } from '@app/shared/components';
import { AuthService } from '../../../../core/services/auth-service';

@Component({
  selector: 'app-olvidaste-contrasena',
  imports: [ReactiveFormsModule, RouterLink, Loader],
  templateUrl: './olvidaste-contrasena.html',
  styleUrl: './olvidaste-contrasena.css',
})
export class OlvidasteContrasena {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly cargando = signal(false);
  readonly mensajeError = signal<string | null>(null);
  readonly mensajeExito = signal<string | null>(null);

  readonly formulario = this.fb.nonNullable.group({
    identificador: [
      '',
      [
        Validators.required,
        Validators.pattern(/^(?:[^\s@]+@[^\s@]+\.[^\s@]+|[a-zA-Z0-9._-]{3,50})$/),
      ],
    ],
  });

  /** Solicita al backend el envío del enlace para restablecer la contraseña. */
  enviar(): void {
    if (this.formulario.invalid || this.cargando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);

    this.auth
      .olvidasteContrasena(this.formulario.controls.identificador.value)
      .pipe(
        timeout(15_000),
        finalize(() => this.cargando.set(false)),
      )
      .subscribe({
        next: () => {
          this.mensajeExito.set(
            'Si existe una cuenta asociada, recibirás un enlace para crear una nueva contraseña.',
          );
        },
        error: (error) => this.mensajeError.set(this.obtenerMensajeError(error)),
      });
  }

  private obtenerMensajeError(error: any): string {
    if (error?.status === 0) {
      return 'No se pudo conectar al servidor. Verifica tu conexión e inténtalo nuevamente.';
    }
    if (error?.name === 'TimeoutError') return 'El servidor tardó demasiado en responder.';

    return error?.error?.message ?? 'No se pudo enviar el enlace. Inténtalo nuevamente.';
  }
}
