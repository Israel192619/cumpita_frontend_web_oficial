import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';

import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toastr = inject(ToastrService);
  const router = inject(Router);
  const authRoutes = [
    '/login',
    '/olvidaste-contrasena',
    '/reestablecer-contrasena'
  ];
  const isAuthRequest = authRoutes.some(route =>
    req.url.includes(route)
  );
  const esSesionServicio = req.headers.has('X-Service-Request') || req.headers.has('X-Service-Session') || req.headers.has('X-Service-Login');

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {

      switch (err.status) {

        case 0:
          toastr.error('No se pudo conectar al servidor');
          break;

        case 401:
          if (!isAuthRequest && !esSesionServicio) {
            toastr.error('Sesión expirada');
            router.navigate(['/login']);
          }
          break;

        case 404:
          toastr.error(
            err.error?.message || 'Recurso no encontrado'
          );
          break;

        case 422:
          const errors = err.error?.errors;

          if (errors) {
            toastr.error(
              Object.values(errors)
                .flat()
                .join(' | ')
            );
          }

          break;

        default:
          toastr.error('Ocurrió un error inesperado');
      }

      return throwError(() => err);
    })
  );
};
