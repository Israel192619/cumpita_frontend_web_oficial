import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest-guard';
import { resetTokenGuard } from './core/guards/reset-token-guard';
import { landingGuard, moduleAccessGuard } from './core/guards/role-guards';
import { pendingPosOrderGuard } from './core/guards/pending-pos-order-guard';

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
        canActivate: [landingGuard],
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard/dashboard').then(m => m.Dashboard)
      },
      {
        path: 'users',
        canActivate: [moduleAccessGuard], data: { access: 'admin' },
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
        path: 'clientes',
        canActivate: [moduleAccessGuard], data: { access: 'admin' },
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/clientes/pages/clientes-list/clientes-list').then(m => m.ClientesList)
          },
          {
            path: 'create',
            loadComponent: () =>
              import('./features/clientes/pages/cliente-create/cliente-create').then(m => m.ClienteCreate)
          },
          {
            path: 'edit/:id',
            loadComponent: () =>
              import('./features/clientes/pages/cliente-edit/cliente-edit').then(m => m.ClienteEdit)
          }
        ]
      },
      {
        path: 'categorias',
        canActivate: [moduleAccessGuard], data: { access: 'admin' },
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
        canActivate: [moduleAccessGuard], data: { access: 'admin' },
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
        canActivate: [moduleAccessGuard], data: { access: 'admin' },
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
      },{
        path: 'pedidos',
        canActivate: [moduleAccessGuard], data: { access: 'admin' },
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/ordenes/pages/ordenes-list/ordenes-list').then(m => m.OrdenesList)
          }
        ]
      },
      {
        path: 'mesas',
        canActivate: [moduleAccessGuard], data: { access: 'admin' },
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/mesas/pages/mesas-list/mesas-list').then(m => m.MesasList)
          },
          {
            path: 'create',
            loadComponent: () =>
              import('./features/mesas/pages/mesa-create/mesa-create').then(m => m.MesaCreate)
          },
          {
            path: 'edit/:id',
            loadComponent: () =>
              import('./features/mesas/pages/mesa-edit/mesa-edit').then(m => m.MesaEdit)
          }
        ]
      },
      {
        path: 'movimientos-caja',
        canActivate: [moduleAccessGuard], data: { access: 'caja' },
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/movimiento-cajas/pages/movimiento-list/movimiento-list').then(m => m.MovimientoList)
          },
          {
            path: 'create',
            loadComponent: () =>
              import('./features/movimiento-cajas/pages/movimiento-create/movimiento-create').then(m => m.MovimientoCreate)
          }
        ]
      },
      {
        path: 'gastos-caja',
        canActivate: [moduleAccessGuard], data: { access: 'caja' },
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/gastos-caja/pages/gasto-list/gasto-list').then(m => m.GastoList)
          },
          {
            path: 'create',
            loadComponent: () =>
              import('./features/gastos-caja/pages/gasto-create/gasto-create').then(m => m.GastoCreate)
          }
        ]
      },
      // Mantiene compatibilidad con accesos anteriores sin cargar el KDS dentro
      // del layout administrativo.
      { path: 'kds', pathMatch: 'full', redirectTo: '/cocina' },
      { path: 'kds/:estacion', redirectTo: route => `/cocina/${route.params['estacion']}` },
      {
        path: 'servicio',
        canActivate: [moduleAccessGuard], data: { access: 'servicio' },
        loadComponent: () =>
          import('./features/servicio/pages/servicio-home/servicio-home').then(m => m.ServicioHome)
      },
      {
        path: 'ajustes-stock',
        canActivate: [moduleAccessGuard], data: { access: 'admin' },
        children: [
          { path: '', loadComponent: () => import('./features/productos/pages/ajustes-stock-list/ajustes-stock-list').then(m => m.AjustesStockList) },
          { path: 'create', loadComponent: () => import('./features/productos/pages/ajuste-stock-create/ajuste-stock-create').then(m => m.AjusteStockCreate) },
        ]
      },
      {
        path: 'reportes',
        canActivate: [moduleAccessGuard], data: { access: 'admin' },
        children: [
          { path: '', redirectTo: 'ventas', pathMatch: 'full' },
          { path: 'ventas', data: { tipo: 'ventas' }, loadComponent: () => import('./features/reportes/pages/reporte-home/reporte-home').then(m => m.ReporteHome) },
          { path: 'productos', data: { tipo: 'productos' }, loadComponent: () => import('./features/reportes/pages/reporte-home/reporte-home').then(m => m.ReporteHome) },
          { path: 'caja', data: { tipo: 'caja' }, loadComponent: () => import('./features/reportes/pages/reporte-home/reporte-home').then(m => m.ReporteHome) },
        ]
      },
      {
        path: 'preordenes/nueva',
        canActivate: [moduleAccessGuard], canDeactivate: [pendingPosOrderGuard], data: { access: 'preorden', mode: 'preorden' },
        loadComponent: () =>
          import('./features/pos/pages/pos-home/pos-home').then(m => m.PosHome)
      }
    ]
  },
  {
    path: 'pos',
    loadComponent: () => import('./layout/pos-layout/pos-layout').then(m => m.PosLayout),
    canActivate: [authGuard, moduleAccessGuard], data: { access: 'pos' },
    children: [
      {
        path: '',
        canDeactivate: [pendingPosOrderGuard],
        loadComponent: () =>
          import('./features/pos/pages/pos-home/pos-home').then(m => m.PosHome)
      }
    ]
  },
  {
    path: 'cocina',
    loadComponent: () => import('./layout/cocina-layout/cocina-layout').then(m => m.CocinaLayout),
    canActivate: [authGuard, moduleAccessGuard], data: { access: 'kds' },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/cocina/pages/cocina-home/cocina-home').then(m => m.CocinaHome)
      },
      {
        path: ':estacion',
        canActivate: [moduleAccessGuard], data: { access: 'kds' },
        loadComponent: () => import('./features/cocina/pages/cocina-home/cocina-home').then(m => m.CocinaHome)
      },
    ]
  }
];
