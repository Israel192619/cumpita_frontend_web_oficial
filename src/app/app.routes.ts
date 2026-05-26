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
        path: 'users',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/users/pages/users-list/users-list').then(m => m.UsersList)
          },
          {
            path: 'create',
            loadComponent: () =>
              import('./features/users/pages/user-create/user-create').then(m => m.UserCreate)
          },
          {
            path: 'edit/:id',
            loadComponent: () =>
              import('./features/users/pages/user-edit/user-edit').then(m => m.UserEdit)
          }
        ]
      },
      {
        path: 'categorias',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/categorias/pages/categoria-list/categoria-list').then(m => m.CategoriaList)
          },
          {
            path: 'create',
            loadComponent: () =>
              import('./features/categorias/pages/categoria-create/categoria-create').then(m => m.CategoriaCreate)
          },
          {
            path: 'edit/:id',
            loadComponent: () =>
              import('./features/categorias/pages/categoria-edit/categoria-edit').then(m => m.CategoriaEdit)
          }
        ]
      },
      {
        path: 'productos',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/productos/pages/productos-list/productos-list').then(m => m.ProductosList)
          },
          {
            path: 'create',
            loadComponent: () =>
              import('./features/productos/pages/producto-create/producto-create').then(m => m.ProductoCreate)
          },
          {
            path: 'edit/:id',
            loadComponent: () =>
              import('./features/productos/pages/producto-edit/producto-edit').then(m => m.ProductoEdit)
          }
        ]
      },
      {
        path: 'modificadores',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/modificadores/pages/modificadores-list/modificadores-list').then(m => m.ModificadoresList)
          },
          {
            path: 'create',
            loadComponent: () =>
              import('./features/modificadores/pages/modificador-create/modificador-create').then(m => m.ModificadorCreate)
          },
          {
            path: 'edit/:id',
            loadComponent: () =>
              import('./features/modificadores/pages/modificador-edit/modificador-edit').then(m => m.ModificadorEdit)
          }
        ]
      }
    ]
  },

  //Ruta no encontrada
  {
    path: '**',
    redirectTo: 'login'
  }
];
