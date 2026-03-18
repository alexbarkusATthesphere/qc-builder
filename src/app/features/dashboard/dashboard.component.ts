import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ProjectService, ProjectDetailRead, ProjectComponentRead } from '../../services/project';
import {
  TemplateService,
  StatusDefinitionRead,
  TaskCategoryRead,
  TaskTypeRead,
} from '../../services/template';
import {
  TaskService,
  TaskRead,
  TaskDetailRead,
  TaskCreate,
  TaskUpdate,
  TaskEnvironment,
  TaskPriority,
} from '../../services/task';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge';
import { TaskDetailPanelComponent } from '../tasks/components/task-detail/task-detail';
import { TaskFormComponent, TaskFormMode } from '../tasks/components/task-form/task-form';

interface ProjectDashboardData {
  project: ProjectDetailRead;
  statuses: StatusDefinitionRead[];
  categories: TaskCategoryRead[];
  types: TaskTypeRead[];
  tasks: TaskRead[];
}

/** A single component's progress within an environment */
export interface EnvComponentProgress {
  name: string;
  total: number;
  done: number;
  blocked: number;
  percent: number;
}

/** A task surfaced in the critical-tasks list */
export interface CriticalTask {
  id: number;
  title: string;
  priority: TaskPriority;
  statusName: string;
  statusColor: string;
  categoryName: string;
  componentName: string;
  assignee: string | null;
}

/** Full data model for a single environment column */
export interface EnvColumnData {
  key: TaskEnvironment;
  label: string;
  color: string;
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  inProgressTasks: number;
  completionPercent: number;
  components: EnvComponentProgress[];
  criticalTasks: CriticalTask[];
  statusSegments: { name: string; color: string; count: number; percent: number }[];
}

/** Priority sort order — lower = more critical */
const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [StatusBadgeComponent, TaskDetailPanelComponent, TaskFormComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private projectService = inject(ProjectService);
  private templateService = inject(TemplateService);
  private taskService = inject(TaskService);
  private router = inject(Router);

  loading = signal(true);
  projectsData = signal<ProjectDashboardData[]>([]);

  // ── Detail panel state ──
  showDetailPanel = signal(false);
  detailLoading = signal(false);
  selectedTaskDetail = signal<TaskDetailRead | null>(null);

  // ── Form panel state ──
  showFormPanel = signal(false);
  formMode = signal<TaskFormMode>('create');
  formTask = signal<TaskRead | null>(null);
  formSaving = signal(false);

  /** Max number of critical tasks to show per environment column */
  private readonly CRITICAL_TASK_LIMIT = 12;

  // ── Derived data for panels ──

  currentStatuses = computed(() => this.projectsData()[0]?.statuses ?? []);
  currentCategories = computed(() => this.projectsData()[0]?.categories ?? []);
  currentTypes = computed(() => this.projectsData()[0]?.types ?? []);
  currentComponents = computed<ProjectComponentRead[]>(
    () => this.projectsData()[0]?.project.components ?? [],
  );
  currentProjectId = computed(() => this.projectsData()[0]?.project.id ?? 0);

  // ── Global summary metrics ──

  totalTasks = computed(() =>
    this.projectsData().reduce((sum, p) => sum + p.tasks.length, 0),
  );

  completedTasks = computed(() =>
    this.projectsData().reduce((sum, p) => {
      const terminalIds = new Set(p.statuses.filter((s) => s.is_terminal).map((s) => s.id));
      return sum + p.tasks.filter((t) => terminalIds.has(t.status_id)).length;
    }, 0),
  );

  completionPercent = computed(() => {
    const total = this.totalTasks();
    if (total === 0) return 0;
    return Math.round((this.completedTasks() / total) * 100);
  });

  blockedTasks = computed(() =>
    this.projectsData().reduce((sum, p) => {
      const blockedId = p.statuses.find((s) => s.name === 'Blocked')?.id;
      return sum + (blockedId ? p.tasks.filter((t) => t.status_id === blockedId).length : 0);
    }, 0),
  );

  projectName = computed(() => this.projectsData()[0]?.project.name ?? '');

  // ── Environment columns ──

  readonly envConfig: { key: TaskEnvironment; label: string; color: string }[] = [
    { key: 'dev', label: 'Development', color: '#3B82F6' },
    { key: 'test', label: 'Test', color: '#F59E0B' },
    { key: 'prod', label: 'Production', color: '#10B981' },
  ];

  envColumns = computed<EnvColumnData[]>(() => {
    const data = this.projectsData()[0];
    if (!data) return [];

    const terminalIds = new Set(data.statuses.filter((s) => s.is_terminal).map((s) => s.id));
    const blockedId = data.statuses.find((s) => s.name === 'Blocked')?.id;
    const inProgressId = data.statuses.find((s) => s.name === 'In Progress')?.id;
    const statusMap = new Map(data.statuses.map((s) => [s.id, s]));
    const categoryMap = new Map(data.categories.map((c) => [c.id, c]));

    const allComponents = [
      ...data.project.components.map((c) => ({ id: c.id as number | null, name: c.name })),
      { id: null as number | null, name: 'General' },
    ];

    return this.envConfig.map((env) => {
      const envTasks = data.tasks.filter((t) => t.environment === env.key);
      const totalTasks = envTasks.length;
      const completedTasks = envTasks.filter((t) => terminalIds.has(t.status_id)).length;
      const blocked = blockedId ? envTasks.filter((t) => t.status_id === blockedId).length : 0;
      const inProgress = inProgressId
        ? envTasks.filter((t) => t.status_id === inProgressId).length
        : 0;

      const components: EnvComponentProgress[] = allComponents
        .map((c) => {
          const tasks = envTasks.filter((t) => t.component_id === c.id);
          const total = tasks.length;
          if (total === 0) return null;
          const done = tasks.filter((t) => terminalIds.has(t.status_id)).length;
          const blockedCount = blockedId
            ? tasks.filter((t) => t.status_id === blockedId).length
            : 0;
          return {
            name: c.name,
            total,
            done,
            blocked: blockedCount,
            percent: Math.round((done / total) * 100),
          };
        })
        .filter((c): c is EnvComponentProgress => c !== null);

      const criticalTasks: CriticalTask[] = envTasks
        .filter((t) => !terminalIds.has(t.status_id))
        .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9))
        .slice(0, this.CRITICAL_TASK_LIMIT)
        .map((t) => {
          const status = statusMap.get(t.status_id);
          const category = categoryMap.get(t.category_id);
          const component = allComponents.find((c) => c.id === t.component_id);
          return {
            id: t.id,
            title: t.title,
            priority: t.priority,
            statusName: status?.name ?? 'Unknown',
            statusColor: status?.color ?? '#94a3b8',
            categoryName: category?.name ?? '',
            componentName: component?.name ?? '',
            assignee: t.assignee,
          };
        });

      const statusSegments = data.statuses
        .map((s) => {
          const count = envTasks.filter((t) => t.status_id === s.id).length;
          return {
            name: s.name,
            color: s.color ?? '#94a3b8',
            count,
            percent: totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0,
          };
        })
        .filter((s) => s.count > 0);

      return {
        ...env,
        totalTasks,
        completedTasks,
        blockedTasks: blocked,
        inProgressTasks: inProgress,
        completionPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        components,
        criticalTasks,
        statusSegments,
      };
    });
  });

  // ── Lifecycle ──

  ngOnInit(): void {
    this.loadDashboard();
  }

  // ── Task Detail Panel ──

  navigateToTask(taskId: number): void {
    this.showDetailPanel.set(true);
    this.detailLoading.set(true);
    this.selectedTaskDetail.set(null);

    this.taskService.getTask(taskId).subscribe({
      next: (detail) => {
        this.selectedTaskDetail.set(detail);
        this.detailLoading.set(false);
      },
      error: () => {
        this.detailLoading.set(false);
      },
    });
  }

  onDetailClosed(): void {
    this.showDetailPanel.set(false);
    this.selectedTaskDetail.set(null);
  }

  // ── Edit from detail ──

  onEditRequested(task: TaskRead): void {
    this.showDetailPanel.set(false);
    this.formMode.set('edit');
    this.formTask.set(task);
    this.showFormPanel.set(true);
  }

  // ── Create new task ──

  onCreateTask(): void {
    this.formMode.set('create');
    this.formTask.set(null);
    this.showFormPanel.set(true);
  }

  onFormClosed(): void {
    this.showFormPanel.set(false);
    this.formTask.set(null);
  }

  onFormSaved(data: TaskCreate | TaskUpdate): void {
    this.formSaving.set(true);

    if (this.formMode() === 'edit' && this.formTask()) {
      this.taskService.updateTask(this.formTask()!.id, data as TaskUpdate).subscribe({
        next: () => {
          this.formSaving.set(false);
          this.showFormPanel.set(false);
          this.formTask.set(null);
          this.loadDashboard();
        },
        error: () => this.formSaving.set(false),
      });
    } else {
      this.taskService.createTask(data as TaskCreate).subscribe({
        next: () => {
          this.formSaving.set(false);
          this.showFormPanel.set(false);
          this.loadDashboard();
        },
        error: () => this.formSaving.set(false),
      });
    }
  }

  // ── Helpers ──

  getPriorityClass(priority: string): string {
    return `db__pri--${priority.toLowerCase()}`;
  }

  formatPriority(priority: string): string {
    return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
  }

  navigateToProject(): void {
    const project = this.projectsData()[0]?.project;
    if (project) {
      this.router.navigate(['/projects', project.id]);
    }
  }

  // ── Data loading ──

  private loadDashboard(): void {
    this.loading.set(true);

    this.projectService.getProjects().subscribe({
      next: (projects) => {
        if (projects.length === 0) {
          this.loading.set(false);
          return;
        }

        const detailCalls = projects.map((p) =>
          forkJoin({
            project: this.projectService.getProject(p.id),
            template: this.templateService.getTemplate(p.template_id),
            tasks: this.taskService.getTasks({ project_id: p.id }),
          }),
        );

        forkJoin(detailCalls).subscribe({
          next: (results) => {
            this.projectsData.set(
              results.map((r) => ({
                project: r.project,
                statuses: r.template.statuses,
                categories: r.template.categories,
                types: r.template.categories.flatMap(() => [] as TaskTypeRead[]),
                tasks: r.tasks,
              })),
            );
            this.loading.set(false);

            // Load types for each category (needed for the form)
            this.loadTypes();
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }

  /** Fetch types for all categories so the form can populate the type dropdown */
  private loadTypes(): void {
    const data = this.projectsData()[0];
    if (!data) return;

    const templateId = data.project.template_id;
    const typeCalls = data.categories.map((cat) =>
      this.templateService.getTypes(templateId, cat.id),
    );

    if (typeCalls.length === 0) return;

    forkJoin(typeCalls).subscribe({
      next: (results) => {
        const allTypes = results.flat();
        const current = this.projectsData();
        if (current.length > 0) {
          this.projectsData.set([{ ...current[0], types: allTypes }, ...current.slice(1)]);
        }
      },
    });
  }
}