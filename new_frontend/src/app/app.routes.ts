import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login-page.component').then(
        (module) => module.LoginPageComponent
      )
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./core/layout/app-shell.component').then(
        (module) => module.AppShellComponent
      ),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page.component').then(
            (module) => module.DashboardPageComponent
          )
      },
      {
        path: 'regulations',
        loadComponent: () =>
          import('./features/regulations/regulation-upload-page.component').then(
            (module) => module.RegulationUploadPageComponent
          )
      },
      {
        path: 'audit-config',
        loadComponent: () =>
          import('./features/audit/audit-config-page.component').then(
            (module) => module.AuditConfigPageComponent
          )
      },
      {
        path: 'results',
        loadComponent: () =>
          import('./features/results/audit-results-page.component').then(
            (module) => module.AuditResultsPageComponent
          )
      },
      {
        path: 'admin',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/admin/admin-page.component').then(
            (module) => module.AdminPageComponent
          )
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
