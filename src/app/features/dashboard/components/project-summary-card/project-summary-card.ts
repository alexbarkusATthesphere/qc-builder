import { Component, computed, input, output } from '@angular/core';

import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge';
import { ProjectDetailRead } from '../../../../services/project';
import { StatusDefinitionRead } from '../../../../services/template';
import { TaskRead } from '../../../../services/task';

@Component({
  selector: 'app-project-summary-card',
  standalone: true,
  imports: [StatusBadgeComponent],
  templateUrl: './project-summary-card.html',
  styleUrl: './project-summary-card.css',
})
export class ProjectSummaryCardComponent {
  project = input.required<ProjectDetailRead>();
  statuses = input.required<StatusDefinitionRead[]>();
  tasks = input.required<TaskRead[]>();

  clicked = output<void>();

  completionPercent = computed(() => {
    const tasks = this.tasks();
    if (tasks.length === 0) return 0;
    const terminalIds = new Set(this.statuses().filter((s) => s.is_terminal).map((s) => s.id));
    const done = tasks.filter((t) => terminalIds.has(t.status_id)).length;
    return Math.round((done / tasks.length) * 100);
  });

  completedCount = computed(() => {
    const terminalIds = new Set(this.statuses().filter((s) => s.is_terminal).map((s) => s.id));
    return this.tasks().filter((t) => terminalIds.has(t.status_id)).length;
  });

  statusSegments = computed(() => {
    const tasks = this.tasks();
    const total = tasks.length || 1;
    return this.statuses()
      .map((s) => {
        const count = tasks.filter((t) => t.status_id === s.id).length;
        return { name: s.name, color: s.color ?? '#94a3b8', percent: (count / total) * 100 };
      })
      .filter((s) => s.percent > 0);
  });

  getProjectStatusColor(status: string): string {
    const map: Record<string, string> = {
      ACTIVE: '#3B82F6', active: '#3B82F6',
      ON_HOLD: '#F59E0B', on_hold: '#F59E0B',
      COMPLETE: '#10B981', complete: '#10B981',
      ARCHIVED: '#6B7280', archived: '#6B7280',
    };
    return map[status] ?? '#6B7280';
  }

  formatStatus(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  onClick(): void {
    this.clicked.emit();
  }
}