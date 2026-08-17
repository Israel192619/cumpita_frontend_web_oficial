import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth-service';

export const guestGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  const token = localStorage.getItem('auth_token');

  if (token && !auth.servicioCelularCerrado()) {
    router.navigate(['/app']);
    return false;
  }
  return true;
};
