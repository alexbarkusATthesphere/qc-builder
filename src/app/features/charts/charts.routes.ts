import { Routes } from '@angular/router';

export const CHARTS_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'waterfall',
    pathMatch: 'full',
  },
  {
    path: 'waterfall',
    loadComponent: () =>
      import('./components/waterfall-chart/waterfall-chart').then(
        (m) => m.WaterfallChartComponent,
      ),
  },
  // {
  //   path: 'gantt',
  //   loadComponent: () =>
  //     import('./components/gnatt-chart/gnatt-chart').then(
  //       (m) => m.GnattChartComponent,
  //     ),
  // },
];