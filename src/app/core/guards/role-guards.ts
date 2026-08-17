import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth-service';

const nombreRol = (nombre?: string | null) => (nombre ?? '').trim().toLocaleLowerCase();

export const servicioGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.me().pipe(
    map(user => ['mesero', 'despacho', 'admin', 'administrador', 'gerente'].includes(nombreRol(user.role?.nombre))
      ? true
      : router.createUrlTree(['/app'])),
    catchError(() => of(router.createUrlTree(['/login'])))
  );
};

export const noMeseroGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.servicioCelularCerrado()) {
    return router.createUrlTree(['/login']);
  }

  return auth.me().pipe(
    map(user => {
      const soloServicio = ['mesero', 'despacho'].includes(nombreRol(user.role?.nombre));
      return !soloServicio || state.url.startsWith('/app/servicio')
        ? true
        : router.createUrlTree(['/app/servicio']);
    }),
    catchError(() => of(router.createUrlTree(['/login'])))
  );
};
