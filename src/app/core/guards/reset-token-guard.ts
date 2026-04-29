import { inject } from '@angular/core/primitives/di';
import { CanActivateFn, Router } from '@angular/router';

export const resetTokenGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);

  const token = route.queryParamMap.get('token');
  const email = route.queryParamMap.get('email');

  if (!token || !email) {
    router.navigate(['/login']);
    return false;
  }
  return true;
};
