import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth-service';
import { homeForUser } from '../auth/role-access';

export const guestGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  const token = localStorage.getItem('auth_token');

  if (token && !auth.servicioCelularCerrado()) {
    auth.me().subscribe({
      next: user => router.navigateByUrl(homeForUser(user)),
      error: () => router.navigate(['/login'])
    });
    return false;
  }
  return true;
};
