import { Component, computed, input, output, signal } from '@angular/core';

import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge';
import { TaskRead } from '../../../../services/task';
import { StatusDefinitionRead, TaskCategoryRead } from '../../../../services/template';
import { ProjectComponentRead } from '../../../../services/project';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [StatusBadgeComponent],
  templateUrl: './task-list.html',
  styleUrl: './task-list.css',
})
export class TaskListComponent {
  tasks = input.required<TaskRead[]>();
  statuses = input.required<StatusDefinitionRead[]>();
  categories = input<TaskCategoryRead[]>([]);
  components = input<ProjectComponentRead[]>([]);

  taskClicked = output<TaskRead>();

  searchQuery = signal('');
  sortField = signal<string>('title');
  sortDir = signal<'asc' | 'desc'>('asc');

  private statusMap = computed(() => {
    const map = new Map<number, StatusDefinitionRead>();
    for (const s of this.statuses()) map.set(s.id, s);
    return map;
  });

  private categoryMap = computed(() => {
    const map = new Map<number, TaskCategoryRead>();
    for (const c of this.categories()) map.set(c.id, c);
    return map;
  });

  private componentMap = computed(() => {
    const map = new Map<number, ProjectComponentRead>();
    for (const c of this.components()) map.set(c.id, c);
    return map;
  });

  displayTasks = computed(() => {
    let rows = [...this.tasks()];
    const q = this.searchQuery().toLowerCase().trim();

    if (q) {
      rows = rows.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.assignee ?? '').toLowerCase().includes(q) ||
          this.getStatusName(t.status_id).toLowerCase().includes(q) ||
          this.getCategoryName(t.category_id).toLowerCase().includes(q),
      );
    }

    const field = this.sortField();
    const dir = this.sortDir();
    rows.sort((a, b) => {
      let aVal = this.getSortValue(a, field);
      let bVal = this.getSortValue(b, field);
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return dir === 'asc' ? cmp : -cmp;
    });

    return rows;
  });

  getStatusName(id: number): string {
    return this.statusMap().get(id)?.name ?? '—';
  }

  getStatusColor(id: number): string | null {
    return this.statusMap().get(id)?.color ?? null;
  }

  getCategoryName(id: number): string {
    return this.categoryMap().get(id)?.name ?? '—';
  }

  getComponentName(id: number | null): string {
    if (id == null) return '—';
    return this.componentMap().get(id)?.name ?? '—';
  }

  formatPriority(p: string): string {
    return p.charAt(0) + p.slice(1).toLowerCase();
  }

  getPriorityClass(p: string): string {
    return `tl__priority--${p.toLowerCase()}`;
  }

  toggleSort(field: string): void {
    if (this.sortField() === field) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
  }

  getSortIcon(field: string): string {
    if (this.sortField() !== field) return '↕';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  onRowClick(task: TaskRead): void {
    this.taskClicked.emit(task);
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  private getSortValue(task: TaskRead, field: string): string {
    switch (field) {
      case 'title':
        return task.title;
      case 'status':
        return this.getStatusName(task.status_id);
      case 'priority':
        return task.priority;
      case 'category':
        return this.getCategoryName(task.category_id);
      case 'component':
        return this.getComponentName(task.component_id);
      case 'assignee':
        return task.assignee ?? '';
      default:
        return '';
    }
  }
}