import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge';
import { ProjectService, ProjectDetailRead } from '../../../../services/project';
import { TemplateService, TemplateDetailRead, StatusDefinitionRead, TaskCategoryRead } from '../../../../services/template';
import { TaskService, TaskRead, TaskDetailRead } from '../../../../services/task';
import { TaskBoardComponent } from '../../../tasks/components/task-board/task-board';
import { TaskListComponent } from '../../../tasks/components/task-list/task-list';
import { TaskDetailPanelComponent } from '../../../tasks/components/task-detail/task-detail';

export type ViewMode = 'board' | 'table';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    StatusBadgeComponent,
    TaskBoardComponent,
    TaskListComponent,
    TaskDetailPanelComponent,
  ],
  templateUrl: './project-detail.html',
  styleUrl: './project-detail.css',
})
export class ProjectDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private templateService = inject(TemplateService);
  private taskService = inject(TaskService);

  // State
  project = signal<ProjectDetailRead | null>(null);
  template = signal<TemplateDetailRead | null>(null);
  tasks = signal<TaskRead[]>([]);
  loading = signal(true);
  viewMode = signal<ViewMode>('board');
  selectedTask = signal<TaskDetailRead | null>(null);
  panelOpen = signal(false);
  panelLoading = signal(false);

  // Filter state
  filterComponent = signal<number | null>(null);
  filterCategory = signal<number | null>(null);
  filterPriority = signal<string | null>(null);

  // Derived
  statuses = computed(() => this.template()?.statuses ?? []);
  categories = computed(() => this.template()?.categories ?? []);
  components = computed(() => this.project()?.components ?? []);

  filteredTasks = computed(() => {
    let result = this.tasks();
    const comp = this.filterComponent();
    const cat = this.filterCategory();
    const pri = this.filterPriority();

    if (comp != null) result = result.filter((t) => t.component_id === comp);
    if (cat != null) result = result.filter((t) => t.category_id === cat);
    if (pri) result = result.filter((t) => t.priority === pri);

    return result;
  });

  statusSummary = computed(() => {
    const tasks = this.tasks();
    const statuses = this.statuses();
    return statuses.map((s) => ({
      ...s,
      count: tasks.filter((t) => t.status_id === s.id).length,
    }));
  });

  activeFilterCount = computed(() => {
    let count = 0;
    if (this.filterComponent() != null) count++;
    if (this.filterCategory() != null) count++;
    if (this.filterPriority()) count++;
    return count;
  });

  ngOnInit(): void {
    const projectId = Number(this.route.snapshot.paramMap.get('projectId'));

    this.projectService
      .getProject(projectId)
      .pipe(
        switchMap((project) => {
          this.project.set(project);
          return forkJoin({
            template: this.templateService.getTemplate(project.template_id),
            tasks: this.taskService.getTasks({ project_id: project.id }),
          });
        }),
      )
      .subscribe({
        next: ({ template, tasks }) => {
          this.template.set(template);
          this.tasks.set(tasks);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  onTaskClicked(task: TaskRead): void {
    this.panelOpen.set(true);
    this.panelLoading.set(true);
    this.selectedTask.set(null);

    this.taskService.getTask(task.id).subscribe({
      next: (detail) => {
        this.selectedTask.set(detail);
        this.panelLoading.set(false);
      },
      error: () => this.panelLoading.set(false),
    });
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.selectedTask.set(null);
  }

  goBack(): void {
    this.router.navigate(['/projects']);
  }

  setFilterComponent(id: number | null): void {
    this.filterComponent.set(id);
  }

  setFilterCategory(id: number | null): void {
    this.filterCategory.set(id);
  }

  setFilterPriority(p: string | null): void {
    this.filterPriority.set(p);
  }

  clearFilters(): void {
    this.filterComponent.set(null);
    this.filterCategory.set(null);
    this.filterPriority.set(null);
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      active: '#05C3DD',   // Sphere Blue
      on_hold: '#fbbf24',
      complete: '#34d399',
      archived: '#64748b',
    };
    return colors[status.toLowerCase()] ?? '#64748b';
  }

  formatProjectStatus(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}