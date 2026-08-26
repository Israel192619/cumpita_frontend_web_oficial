import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.css',
})
export class AuthLayout {
  readonly nombreApp = environment.nombreApp;

  /** Evita mostrar el icono de imagen rota si el logotipo no está disponible. */
  ocultarLogo(evento: Event): void {
    const imagen = evento.target as HTMLImageElement | null;
    if (imagen) imagen.hidden = true;
  }
}
