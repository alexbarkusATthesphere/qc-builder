import { Routes } from '@angular/router';

export const CHART_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/gnatt-chart/gnatt-chart').then((m) => m.GnattChart),
  },
  {
    path: 'waterfall',
    loadComponent: () =>
      import('./components/waterfall-chart/waterfall-chart').then((m) => m.WaterfallChart),
  },
];