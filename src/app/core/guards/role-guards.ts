import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AppAccess, homeForUser, isAdministrator, kdsStation, userCanAccess } from '../auth/role-access';
import { AuthService } from '../services/auth-service';

const protect = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const access = route.data['access'] as AppAccess | undefined;

  return auth.me().pipe(
    map(user => {
      if (!access || !userCanAccess(user, access)) return router.createUrlTree([homeForUser(user)]);
      if (access === 'kds') {
        const requestedStation = (route.paramMap.get('estacion') || route.data['station'])?.toLocaleLowerCase();
        if (requestedStation && !isAdministrator(user) && requestedStation !== kdsStation(user)) {
          return router.createUrlTree([`/app/kds/${kdsStation(user)}`]);
        }
      }
      return true;
    }),
    catchError(() => of(router.createUrlTree(['/login'])))
  );
};

export const moduleAccessGuard: CanActivateFn = route => protect(route);

export const landingGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.me().pipe(
    map(user => isAdministrator(user) ? true : router.createUrlTree([homeForUser(user)])),
    catchError(() => of(router.createUrlTree(['/login'])))
  );
};

export const servicioGuard: CanActivateFn = route => {
  route.data = { ...route.data, access: 'servicio' };
  return protect(route);
};

// Compatibilidad para imports anteriores; las rutas nuevas deben declarar data.access.
export const noMeseroGuard: CanActivateFn = route => protect(route);
