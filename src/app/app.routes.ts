import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
  },
  {
    path: 'projects',
    loadChildren: () =>
      import('./features/projects/project.routes').then((m) => m.PROJECT_ROUTES),
  },
  {
    path: 'tasks',
    loadChildren: () =>
      import('./features/tasks/tasks.routes').then((m) => m.TASK_ROUTES),
  },
  {
    path: 'admin',
    loadChildren: () =>
      import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: 'charts',
    loadChildren: () =>
      import('./features/charts/charts.routes').then((m) => m.CHARTS_ROUTES),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];