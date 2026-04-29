import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest-guard';
import { resetTokenGuard } from './core/guards/reset-token-guard';

export const routes: Routes = [
  // Rutas públicas (auth)
  {
    path: '',
    loadComponent: () => import('./layout/auth-layout/auth-layout/auth-layout').then(m => m.AuthLayout),
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/pages/login/login').then(m => m.Login)
      },
      {
        path: 'olvidaste-contrasena',
        loadComponent: () =>
          import('./features/auth/pages/olvidaste-contrasena/olvidaste-contrasena').then(m => m.OlvidasteContrasena)
      },
      {
        path: 'reestablecer-contrasena',
        loadComponent: () =>
          import('./features/auth/pages/reestablecer-contrasena/reestablecer-contrasena').then(m => m.ReestablecerContrasena),
        canActivate: [resetTokenGuard]
      },
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full'
      }
    ]
  },

  // Rutas protegidas (sistema)
  {
    path: 'app',
    loadComponent: () => import('./layout/main-layout/main-layout/main-layout').then(m => m.MainLayout),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard/dashboard').then(m => m.Dashboard)
      },
      {
        path: 'users/list',
        loadComponent: () =>
          import('./features/users/pages/users-list/users-list').then(m => m.UsersList)
      },
      {
        path: 'user/create',
        loadComponent: () =>
          import('./features/users/pages/user-create/user-create').then(m => m.UserCreate)
      },
      {
        path: 'user/edit/:id',
        loadComponent: () =>
          import('./features/users/pages/user-edit/user-edit').then(m => m.UserEdit)
      }
      //    {
      //      path: 'orders',
      //      loadComponent: () =>
      //        import('./features/orders/pages/order-list/order-list.component')
      //    },
      //    {
      //      path: 'kitchen',
      //      loadComponent: () =>
      //        import('./features/kitchen/pages/kitchen-board/kitchen-board.component')
      //    },
    ]
  },

  //Ruta no encontrada
  {
    path: '**',
    redirectTo: 'login'
  }
];
