import { Component, input, output } from '@angular/core';

import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge';
import { TaskDetailRead } from '../../../../services/task';
import { StatusDefinitionRead, TaskCategoryRead } from '../../../../services/template';
import { ProjectComponentRead } from '../../../../services/project';

@Component({
  selector: 'app-task-detail-panel',
  standalone: true,
  imports: [StatusBadgeComponent],
  templateUrl: './task-detail.html',
  styleUrl: './task-detail.css',
})
export class TaskDetailPanelComponent {
  task = input<TaskDetailRead | null>(null);
  loading = input(false);
  statuses = input<StatusDefinitionRead[]>([]);
  categories = input<TaskCategoryRead[]>([]);
  components = input<ProjectComponentRead[]>([]);

  closed = output<void>();

  close(): void {
    this.closed.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('tdp__overlay')) {
      this.close();
    }
  }

  getStatusName(id: number): string {
    return this.statuses().find((s) => s.id === id)?.name ?? '—';
  }

  getStatusColor(id: number): string | null {
    return this.statuses().find((s) => s.id === id)?.color ?? null;
  }

  getCategoryName(id: number): string {
    return this.categories().find((c) => c.id === id)?.name ?? '—';
  }

  getCategoryColor(id: number): string | null {
    return this.categories().find((c) => c.id === id)?.color ?? null;
  }

  getComponentName(id: number | null): string {
    if (id == null) return '—';
    return this.components().find((c) => c.id === id)?.name ?? '—';
  }

  formatPriority(p: string): string {
    return p.charAt(0) + p.slice(1).toLowerCase();
  }

  getPriorityClass(p: string): string {
    return `tdp__priority-val--${p.toLowerCase()}`;
  }

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  formatShortDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}