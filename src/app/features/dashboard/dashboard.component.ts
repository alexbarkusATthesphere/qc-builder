import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-slate-900">Dashboard</h1>
      <p class="text-slate-500">Project overview coming in Sprint 3.</p>
    </div>
  `,
})
export class DashboardComponent {}