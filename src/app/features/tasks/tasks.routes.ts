import { Routes } from '@angular/router';

export const TASK_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/task-board/task-board').then((m) => m.TaskBoardComponent),
  },
  {
    path: ':taskId',
    loadComponent: () =>
      import('./components/task-detail/task-detail').then((m) => m.TaskDetailPanelComponent),
  },
];