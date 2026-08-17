import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('auth_token');
  const esSesionServicio = req.headers.has('X-Service-Request') || req.headers.has('X-Service-Session') || req.headers.has('X-Service-Login');

  let authReq = req;

  if (token && !req.headers.has('Authorization')) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }
  return next(authReq).pipe(
    catchError((error) => {
      if (error.status === 401 && !esSesionServicio) {
        localStorage.removeItem('auth_token');
        //router.navigate(['/login']); 
      }
      return throwError(() => error);
    })
  );
};
