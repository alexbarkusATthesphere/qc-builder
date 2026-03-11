import { Routes } from '@angular/router';

export const PROJECT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/project-list/project-list').then((m) => m.ProjectListComponent),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./components/project-form/project-form').then((m) => m.ProjectForm),
  },
  {
    path: ':projectId',
    loadComponent: () =>
      import('./components/project-detail/project-detail').then((m) => m.ProjectDetailComponent),
  },
  {
    path: ':projectId/edit',
    loadComponent: () =>
      import('./components/project-form/project-form').then((m) => m.ProjectForm),
  },
];