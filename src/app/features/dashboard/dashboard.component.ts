import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ProjectService, ProjectDetailRead } from '../../services/project';
import { TemplateService, StatusDefinitionRead, TaskCategoryRead } from '../../services/template';
import { TaskService, TaskRead, TaskEnvironment } from '../../services/task';
import { ProjectSummaryCardComponent } from './components/project-summary-card/project-summary-card';
import { ActivityFeedComponent, ActivityItem } from './components/activity-feed/activity-feed';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge';

interface ProjectDashboardData {
  project: ProjectDetailRead;
  statuses: StatusDefinitionRead[];
  categories: TaskCategoryRead[];
  tasks: TaskRead[];
}

type EnvFilter = TaskEnvironment | 'all';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ProjectSummaryCardComponent, ActivityFeedComponent, StatusBadgeComponent],
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
  activeEnvFilter = signal<EnvFilter>('all');

  /** Filter pills shown in the header */
  readonly envFilters: { key: EnvFilter; label: string }[] = [
    { key: 'all',  label: 'All' },
    { key: 'dev',  label: 'Dev' },
    { key: 'test', label: 'Test' },
    { key: 'prod', label: 'Prod' },
  ];

  /** Tasks scoped by the active environment filter */
  private filteredTasks = computed(() => {
    const env = this.activeEnvFilter();
    return this.projectsData().map((p) => ({
      ...p,
      tasks: env === 'all' ? p.tasks : p.tasks.filter((t) => t.environment === env),
    }));
  });

  // ── Hero metrics ──
  totalTasks = computed(() =>
    this.filteredTasks().reduce((sum, p) => sum + p.tasks.length, 0),
  );

  completedTasks = computed(() =>
    this.filteredTasks().reduce((sum, p) => {
      const terminalIds = new Set(p.statuses.filter((s) => s.is_terminal).map((s) => s.id));
      return sum + p.tasks.filter((t) => terminalIds.has(t.status_id)).length;
    }, 0),
  );

  blockedTasks = computed(() =>
    this.filteredTasks().reduce((sum, p) => {
      const blockedId = p.statuses.find((s) => s.name === 'Blocked')?.id;
      return sum + (blockedId ? p.tasks.filter((t) => t.status_id === blockedId).length : 0);
    }, 0),
  );

  inProgressTasks = computed(() =>
    this.filteredTasks().reduce((sum, p) => {
      const ipId = p.statuses.find((s) => s.name === 'In Progress')?.id;
      return sum + (ipId ? p.tasks.filter((t) => t.status_id === ipId).length : 0);
    }, 0),
  );

  completionPercent = computed(() => {
    const total = this.totalTasks();
    if (total === 0) return 0;
    return Math.round((this.completedTasks() / total) * 100);
  });

  // ── Status breakdown ──
  statusBreakdown = computed(() => {
    const data = this.filteredTasks()[0];
    if (!data) return [];
    const total = data.tasks.length || 1;
    return data.statuses.map((s) => {
      const count = data.tasks.filter((t) => t.status_id === s.id).length;
      return {
        name: s.name,
        color: s.color ?? '#94a3b8',
        count,
        percent: Math.round((count / total) * 100),
      };
    });
  });

  // ── Component progress ──
  componentProgress = computed(() => {
    const data = this.filteredTasks()[0];
    if (!data) return [];
    const terminalIds = new Set(data.statuses.filter((s) => s.is_terminal).map((s) => s.id));
    const blockedId = data.statuses.find((s) => s.name === 'Blocked')?.id;
    const components = data.project.components;

    const allComponents = [
      ...components.map((c) => ({ id: c.id as number | null, name: c.name })),
      { id: null as number | null, name: 'General' },
    ];

    return allComponents
      .map((c) => {
        const tasks = data.tasks.filter((t) => t.component_id === c.id);
        const total = tasks.length;
        if (total === 0) return null;
        const done = tasks.filter((t) => terminalIds.has(t.status_id)).length;
        const blocked = blockedId ? tasks.filter((t) => t.status_id === blockedId).length : 0;
        return {
          name: c.name,
          total,
          done,
          blocked,
          percent: Math.round((done / total) * 100),
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  });

  // ── Priority breakdown ──
  priorityBreakdown = computed(() => {
    const data = this.filteredTasks()[0];
    if (!data) return [];
    const priorities: { key: string; label: string; color: string }[] = [
      { key: 'critical', label: 'Critical', color: '#dc2626' },
      { key: 'high',     label: 'High',     color: '#f97316' },
      { key: 'medium',   label: 'Medium',   color: '#d97706' },
      { key: 'low',      label: 'Low',      color: '#6b7280' },
    ];
    const total = data.tasks.length || 1;
    return priorities
      .map((p) => {
        const count = data.tasks.filter((t) => t.priority === p.key).length;
        return { ...p, count, percent: Math.round((count / total) * 100) };
      })
      .filter((p) => p.count > 0);
  });

  // ── Environment breakdown (always shows unfiltered data) ──
  environmentBreakdown = computed(() => {
    const data = this.projectsData()[0];
    if (!data) return [];
    const envConfig: { key: TaskEnvironment; label: string; color: string }[] = [
      { key: 'dev',  label: 'Development', color: '#3B82F6' },
      { key: 'test', label: 'Test',        color: '#F59E0B' },
      { key: 'prod', label: 'Production',  color: '#10B981' },
    ];
    const total = data.tasks.length || 1;
    return envConfig
      .map((e) => {
        const tasks = data.tasks.filter((t) => t.environment === e.key);
        const terminalIds = new Set(data.statuses.filter((s) => s.is_terminal).map((s) => s.id));
        const done = tasks.filter((t) => terminalIds.has(t.status_id)).length;
        return {
          ...e,
          count: tasks.length,
          done,
          percent: Math.round((tasks.length / total) * 100),
          completionPercent: tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0,
        };
      })
      .filter((e) => e.count > 0);
  });

  // ── Activity feed ──
  activityItems = computed<ActivityItem[]>(() => {
    const data = this.filteredTasks()[0];
    if (!data) return [];
    const statusMap = new Map(data.statuses.map((s) => [s.id, s]));
    const categoryMap = new Map(data.categories.map((c) => [c.id, c]));

    return [...data.tasks]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 15)
      .map((t) => {
        const status = statusMap.get(t.status_id);
        const category = categoryMap.get(t.category_id);
        return {
          id: t.id,
          title: t.title,
          statusName: status?.name ?? 'Unknown',
          statusColor: status?.color ?? '#94a3b8',
          categoryName: category?.name ?? '',
          priority: t.priority,
          timestamp: t.updated_at,
        };
      });
  });

  ngOnInit(): void {
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
                tasks: r.tasks,
              })),
            );
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }

  setEnvFilter(env: EnvFilter): void {
    this.activeEnvFilter.set(env);
  }

  navigateToProject(projectId: number): void {
    this.router.navigate(['/projects', projectId]);
  }
}