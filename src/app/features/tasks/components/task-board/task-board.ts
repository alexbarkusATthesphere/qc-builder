import { Component, computed, input, output } from '@angular/core';

import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge';
import { TaskRead } from '../../../../services/task';
import { StatusDefinitionRead, TaskCategoryRead } from '../../../../services/template';
import { ProjectComponentRead } from '../../../../services/project';

interface KanbanColumn {
  status: StatusDefinitionRead;
  tasks: TaskRead[];
}

@Component({
  selector: 'app-task-board',
  standalone: true,
  imports: [StatusBadgeComponent],
  templateUrl: './task-board.html',
  styleUrl: './task-board.css',
})
export class TaskBoardComponent {
  tasks = input.required<TaskRead[]>();
  statuses = input.required<StatusDefinitionRead[]>();
  categories = input<TaskCategoryRead[]>([]);
  components = input<ProjectComponentRead[]>([]);

  taskClicked = output<TaskRead>();
  createRequested = output<void>();

  columns = computed<KanbanColumn[]>(() => {
    const tasks = this.tasks();
    const statuses = this.statuses();

    return statuses.map((status) => ({
      status,
      tasks: tasks.filter((t) => t.status_id === status.id),
    }));
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

  getCategoryName(id: number): string {
    return this.categoryMap().get(id)?.name ?? 'Unknown';
  }

  getCategoryColor(id: number): string {
    return this.categoryMap().get(id)?.color ?? '#94a3b8';
  }

  getComponentName(id: number | null): string {
    if (id == null) return '';
    return this.componentMap().get(id)?.name ?? '';
  }

  getPriorityClass(priority: string): string {
    return `tb__priority--${priority.toLowerCase()}`;
  }

  formatPriority(priority: string): string {
    return priority.charAt(0) + priority.slice(1).toLowerCase();
  }

  onCardClick(task: TaskRead): void {
    this.taskClicked.emit(task);
  }

  onCreateClick(): void {
    this.createRequested.emit();
  }
}