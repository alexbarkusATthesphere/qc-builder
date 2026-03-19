import { Component, computed, inject, OnInit, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ProjectService, ProjectDetailRead, ProjectComponentRead } from '../../../../services/project';
import {
  TemplateService,
  StatusDefinitionRead,
  TaskCategoryRead,
} from '../../../../services/template';
import {
  TaskService,
  TaskRead,
  TaskDetailRead,
  TaskCreate,
  TaskUpdate,
  TaskEnvironment,
  TaskPriority,
} from '../../../../services/task';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge';
import { TaskDetailPanelComponent } from '../../../tasks/components/task-detail/task-detail';
import { TaskFormComponent, TaskFormMode } from '../../../tasks/components/task-form/task-form';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = 'technical' | 'executive';
type EnvFilter = 'all' | TaskEnvironment;
type GroupBy = 'component' | 'category' | 'environment';

/** Maps view mode → template name used to select the correct project */
const VIEW_TEMPLATE: Record<ViewMode, string> = {
  technical: 'QC Builder',
  executive: 'Executive Roadmap Summary',
};

interface WaterfallBar {
  task: TaskRead;
  left: number;          // px offset from timeline start
  width: number;         // px width
  statusName: string;
  statusColor: string;
  priorityClass: string;
  componentName: string;
  categoryName: string;
  isCompleted: boolean;
  progressPercent: number;
}

interface WaterfallGroup {
  key: string;
  label: string;
  color: string;
  bars: WaterfallBar[];
  collapsed: boolean;
  summary: GroupSummaryBar;
}

/** Consolidated bar shown when a group is collapsed */
interface GroupSummaryBar {
  left: number;
  width: number;
  completedPercent: number;
  blockedPercent: number;
  inProgressPercent: number;
  totalCount: number;
  completedCount: number;
  blockedCount: number;
  inProgressCount: number;
  startLabel: string;
  endLabel: string;
}

interface TimelineMonth {
  label: string;
  left: number;
  width: number;
}

interface TimelineWeek {
  left: number;
  width: number;
  label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_PX = 6;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 52;

const ENV_LABELS: Record<string, string> = {
  dev: 'Development',
  DEV: 'Development',
  test: 'Test',
  TEST: 'Test',
  prod: 'Production',
  PROD: 'Production',
};

const ENV_COLORS: Record<string, string> = {
  dev: '#3B82F6',
  DEV: '#3B82F6',
  test: '#F59E0B',
  TEST: '#F59E0B',
  prod: '#10B981',
  PROD: '#10B981',
};

/** Sort order for environment groups: Dev → Test → Prod */
const ENV_SORT_ORDER: Record<string, number> = {
  Development: 0, dev: 0, DEV: 0,
  Test: 1, test: 1, TEST: 1,
  Production: 2, prod: 2, PROD: 2,
};

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0, CRITICAL: 0,
  high: 1, HIGH: 1,
  medium: 2, MEDIUM: 2,
  low: 3, LOW: 3,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@Component({
  selector: 'app-waterfall-chart',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusBadgeComponent, TaskDetailPanelComponent, TaskFormComponent],
  templateUrl: './waterfall-chart.html',
  styleUrl: './waterfall-chart.css',
})
export class WaterfallChartComponent implements OnInit, AfterViewInit {
  @ViewChild('timelineBody') timelineBody!: ElementRef<HTMLDivElement>;
  @ViewChild('timelineHeader') timelineHeader!: ElementRef<HTMLDivElement>;
  @ViewChild('labelColumn') labelColumn!: ElementRef<HTMLDivElement>;

  private projectService = inject(ProjectService);
  private templateService = inject(TemplateService);
  private taskService = inject(TaskService);
  private router = inject(Router);

  // ── Loading state ──
  loading = signal(true);

  // ── View mode ──
  viewMode = signal<ViewMode>('technical');
  isExecutiveView = computed(() => this.viewMode() === 'executive');

  // ── Raw data ──
  project = signal<ProjectDetailRead | null>(null);
  statuses = signal<StatusDefinitionRead[]>([]);
  categories = signal<TaskCategoryRead[]>([]);
  allTasks = signal<TaskRead[]>([]);

  // ── Filters ──
  envFilter = signal<EnvFilter>('all');
  groupBy = signal<GroupBy>('component');
  priorityFilter = signal<TaskPriority | 'all'>('all');
  searchQuery = signal('');
  collapsedGroups = signal<Set<string>>(new Set());

  // ── Detail panel state ──
  showDetailPanel = signal(false);
  detailLoading = signal(false);
  selectedTaskDetail = signal<TaskDetailRead | null>(null);

  // ── Form panel state ──
  showFormPanel = signal(false);
  formMode = signal<TaskFormMode>('create');
  formTask = signal<TaskRead | null>(null);
  formSaving = signal(false);
  currentTypes = signal<any[]>([]);

  // ── Tooltip state ──
  tooltip = signal<{ visible: boolean; x: number; y: number; bar: WaterfallBar | null }>({
    visible: false, x: 0, y: 0, bar: null,
  });

  // ── Derived data ──

  currentComponents = computed<ProjectComponentRead[]>(
    () => this.project()?.components ?? [],
  );
  currentProjectId = computed(() => this.project()?.id ?? 0);
  projectName = computed(() => this.project()?.name ?? '');

  /** Filtered tasks based on env, priority, search */
  filteredTasks = computed(() => {
    let tasks = this.allTasks();
    const env = this.envFilter();
    const priority = this.priorityFilter();
    const query = this.searchQuery().toLowerCase().trim();

    if (env !== 'all') {
      tasks = tasks.filter(t => t.environment?.toUpperCase() === env.toUpperCase());
    }
    if (priority !== 'all') {
      tasks = tasks.filter(t => t.priority?.toUpperCase() === priority.toUpperCase());
    }
    if (query) {
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(query) ||
        (t.assignee?.toLowerCase().includes(query) ?? false)
      );
    }
    return tasks;
  });

  /** Timeline date range */
  timelineStart = computed(() => {
    const tasks = this.filteredTasks();
    if (tasks.length === 0) return new Date();
    const dates = tasks
      .map(t => t.start_date ? new Date(t.start_date) : null)
      .filter((d): d is Date => d !== null);
    if (dates.length === 0) return new Date();
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    // Round down to first of month
    return new Date(min.getFullYear(), min.getMonth(), 1);
  });

  timelineEnd = computed(() => {
    const tasks = this.filteredTasks();
    if (tasks.length === 0) return new Date();
    const dates = tasks
      .map(t => t.due_date ? new Date(t.due_date) : (t.start_date ? new Date(t.start_date) : null))
      .filter((d): d is Date => d !== null);
    if (dates.length === 0) return new Date();
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    // Round up to end of month + 1 week buffer
    return new Date(max.getFullYear(), max.getMonth() + 1, 7);
  });

  totalDays = computed(() => {
    const start = this.timelineStart();
    const end = this.timelineEnd();
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  });

  timelineWidth = computed(() => this.totalDays() * DAY_PX);

  /** Month markers for the timeline header */
  months = computed<TimelineMonth[]>(() => {
    const start = this.timelineStart();
    const end = this.timelineEnd();
    const months: TimelineMonth[] = [];

    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor < end) {
      const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const monthStart = Math.max(0, this.dateToPx(cursor));
      const monthEnd = Math.min(this.timelineWidth(), this.dateToPx(nextMonth));

      months.push({
        label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        left: monthStart,
        width: monthEnd - monthStart,
      });
      cursor = nextMonth;
    }
    return months;
  });

  /** Week gridlines */
  weeks = computed<TimelineWeek[]>(() => {
    const start = this.timelineStart();
    const end = this.timelineEnd();
    const weeks: TimelineWeek[] = [];

    // Start from first Monday
    let cursor = new Date(start);
    cursor.setDate(cursor.getDate() + ((8 - cursor.getDay()) % 7));

    while (cursor < end) {
      weeks.push({
        left: this.dateToPx(cursor),
        width: 7 * DAY_PX,
        label: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
      cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    return weeks;
  });

  /** Today marker position */
  todayPx = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.dateToPx(today);
  });

  todayVisible = computed(() => {
    const px = this.todayPx();
    return px >= 0 && px <= this.timelineWidth();
  });

  /** Grouped waterfall bars */
  groups = computed<WaterfallGroup[]>(() => {
    const tasks = this.filteredTasks();
    const statusMap = new Map(this.statuses().map(s => [s.id, s]));
    const categoryMap = new Map(this.categories().map(c => [c.id, c]));
    const terminalIds = new Set(this.statuses().filter(s => s.is_terminal).map(s => s.id));
    const components = this.project()?.components ?? [];
    const componentMap = new Map(components.map(c => [c.id, c]));

    // Build bars — include ALL tasks, using placeholder position for undated ones
    const bars: WaterfallBar[] = tasks
      .map(t => {
        const hasDates = !!t.start_date;
        const start = t.start_date
          ? new Date(t.start_date)
          : new Date(); // placeholder: today
        const end = t.due_date
          ? new Date(t.due_date)
          : hasDates
            ? new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
            : new Date(); // zero-width placeholder for undated
        const status = statusMap.get(t.status_id);
        const category = categoryMap.get(t.category_id);
        const component = t.component_id ? componentMap.get(t.component_id) : null;
        const isCompleted = terminalIds.has(t.status_id);

        // Calculate progress for in-progress tasks
        let progressPercent = 0;
        if (isCompleted) {
          progressPercent = 100;
        } else if (status?.name === 'In Progress' || status?.name === 'In Review') {
          const totalMs = end.getTime() - start.getTime();
          const elapsedMs = new Date().getTime() - start.getTime();
          progressPercent = totalMs > 0
            ? Math.min(95, Math.max(5, Math.round((elapsedMs / totalMs) * 100)))
            : 0;
        }

        return {
          task: t,
          left: this.dateToPx(start),
          width: hasDates ? Math.max(DAY_PX, this.dateToPx(end) - this.dateToPx(start)) : 0,
          statusName: status?.name ?? 'Unknown',
          statusColor: status?.color ?? '#94a3b8',
          priorityClass: `wf__pri--${(t.priority ?? 'medium').toLowerCase()}`,
          componentName: component?.name ?? 'General',
          categoryName: category?.name ?? 'Unknown',
          isCompleted,
          progressPercent,
        };
      });

    // Group bars
    const groupBy = this.groupBy();
    const groupMap = new Map<string, WaterfallBar[]>();

    for (const bar of bars) {
      let key: string;
      if (groupBy === 'component') {
        key = bar.componentName;
      } else if (groupBy === 'category') {
        key = bar.categoryName;
      } else {
        key = bar.task.environment ?? 'Unknown';
      }
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(bar);
    }

    // Sort bars within groups by start date
    for (const bars of groupMap.values()) {
      bars.sort((a, b) => a.left - b.left);
    }

    const collapsed = this.collapsedGroups();
    const blockedId = this.statuses().find(s => s.name === 'Blocked')?.id;
    const inProgressId = this.statuses().find(s => s.name === 'In Progress')?.id;
    const inReviewId = this.statuses().find(s => s.name === 'In Review')?.id;

    // Build group objects with summary bars
    const groups: WaterfallGroup[] = Array.from(groupMap.entries()).map(([key, bars]) => {
      let color = '#94a3b8';
      if (groupBy === 'component') {
        const comp = components.find(c => c.name === key);
        // Use env colors based on component type, or default
        color = key === 'ETL Pipelines' ? '#F59E0B'
              : key === 'API' ? '#3B82F6'
              : key === 'Frontend' ? '#10B981'
              : '#8B5CF6';
      } else if (groupBy === 'category') {
        const cat = this.categories().find(c => c.name === key);
        color = cat?.color ?? '#94a3b8';
      } else {
        color = ENV_COLORS[key] ?? '#94a3b8';
      }

      // ── Compute summary bar ──
      const totalCount = bars.length;
      const completedCount = bars.filter(b => b.isCompleted).length;
      const blockedCount = blockedId
        ? bars.filter(b => b.task.status_id === blockedId).length : 0;
      const inProgressCount = bars.filter(b =>
        b.task.status_id === inProgressId || b.task.status_id === inReviewId
      ).length;

      // Span: earliest left edge → rightmost right edge (only from dated bars)
      const datedBars = bars.filter(b => b.task.start_date);
      const summaryLeft = datedBars.length > 0 ? Math.min(...datedBars.map(b => b.left)) : 0;
      const summaryRight = datedBars.length > 0
        ? Math.max(...datedBars.map(b => b.left + b.width)) : 0;
      const summaryWidth = datedBars.length > 0
        ? Math.max(DAY_PX, summaryRight - summaryLeft) : 0;

      // Date labels for the summary
      const startDates = bars
        .map(b => b.task.start_date).filter(Boolean) as string[];
      const endDates = bars
        .map(b => b.task.due_date ?? b.task.start_date).filter(Boolean) as string[];
      const minDate = startDates.length > 0
        ? startDates.sort()[0] : '';
      const maxDate = endDates.length > 0
        ? endDates.sort().reverse()[0] : '';

      const fmtShort = (d: string) => d
        ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '—';

      const summary: GroupSummaryBar = {
        left: summaryLeft,
        width: summaryWidth,
        completedPercent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
        blockedPercent: totalCount > 0 ? Math.round((blockedCount / totalCount) * 100) : 0,
        inProgressPercent: totalCount > 0 ? Math.round((inProgressCount / totalCount) * 100) : 0,
        totalCount,
        completedCount,
        blockedCount,
        inProgressCount,
        startLabel: fmtShort(minDate),
        endLabel: fmtShort(maxDate),
      };

      return {
        key,
        label: groupBy === 'environment' ? (ENV_LABELS[key] ?? key) : key,
        color,
        bars,
        collapsed: collapsed.has(key),
        summary,
      };
    });

    // Sort groups: env order for environment, display_order for category, alphabetical for component
    if (groupBy === 'environment') {
      groups.sort((a, b) =>
        (ENV_SORT_ORDER[a.key] ?? 99) - (ENV_SORT_ORDER[b.key] ?? 99)
      );
    } else if (groupBy === 'category') {
      const catOrderMap = new Map(this.categories().map(c => [c.name, c.display_order]));
      groups.sort((a, b) =>
        (catOrderMap.get(a.key) ?? 99) - (catOrderMap.get(b.key) ?? 99)
      );
    } else {
      groups.sort((a, b) => a.label.localeCompare(b.label));
    }
    return groups;
  });

  /** Summary stats */
  totalFiltered = computed(() => this.filteredTasks().length);
  completedFiltered = computed(() => {
    const terminalIds = new Set(this.statuses().filter(s => s.is_terminal).map(s => s.id));
    return this.filteredTasks().filter(t => terminalIds.has(t.status_id)).length;
  });
  completionPercent = computed(() => {
    const total = this.totalFiltered();
    return total > 0 ? Math.round((this.completedFiltered() / total) * 100) : 0;
  });
  blockedCount = computed(() => {
    const blockedId = this.statuses().find(s => s.name === 'Blocked')?.id;
    return blockedId ? this.filteredTasks().filter(t => t.status_id === blockedId).length : 0;
  });

  /** Total height of the timeline body */
  totalContentHeight = computed(() => {
    let rows = 0;
    for (const group of this.groups()) {
      rows += 1; // group header
      if (!group.collapsed) {
        rows += group.bars.length;
      }
    }
    return rows * ROW_HEIGHT + 24;
  });

  /** Status legend items */
  statusLegend = computed(() => {
    return this.statuses().map(s => ({
      name: s.name,
      color: s.color ?? '#94a3b8',
    }));
  });

  // ── Lifecycle ──

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    // Scroll to today on initial load
    setTimeout(() => this.scrollToToday(), 500);
  }

  // ── View mode handler ──

  setViewMode(mode: ViewMode): void {
    if (mode === this.viewMode()) return;
    this.viewMode.set(mode);
    // Reset filters on view switch
    this.envFilter.set('all');
    this.priorityFilter.set('all');
    this.searchQuery.set('');
    this.collapsedGroups.set(new Set());
    // Executive view defaults to category grouping (the 4 roadmap phases)
    this.groupBy.set(mode === 'executive' ? 'category' : 'component');
    this.loadData();
  }

  // ── Filter handlers ──

  setEnvFilter(env: EnvFilter): void {
    this.envFilter.set(env);
  }

  setGroupBy(group: GroupBy): void {
    this.groupBy.set(group);
    this.collapsedGroups.set(new Set());
  }

  setPriorityFilter(p: TaskPriority | 'all'): void {
    this.priorityFilter.set(p);
  }

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  toggleGroup(key: string): void {
    const current = new Set(this.collapsedGroups());
    if (current.has(key)) {
      current.delete(key);
    } else {
      current.add(key);
    }
    this.collapsedGroups.set(current);
  }

  // ── Timeline helpers ──

  dateToPx(date: Date): number {
    const start = this.timelineStart();
    const diffDays = (date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    return Math.round(diffDays * DAY_PX);
  }

  scrollToToday(): void {
    if (this.timelineBody && this.todayVisible()) {
      const container = this.timelineBody.nativeElement;
      const todayPx = this.todayPx();
      container.scrollLeft = Math.max(0, todayPx - container.clientWidth / 3);
    }
  }

  onTimelineScroll(event: Event): void {
    const target = event.target as HTMLDivElement;
    if (this.timelineHeader) {
      this.timelineHeader.nativeElement.scrollLeft = target.scrollLeft;
    }
  }

  // ── Bar interactions ──

  onBarMouseEnter(event: MouseEvent, bar: WaterfallBar): void {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.tooltip.set({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      bar,
    });
  }

  onBarMouseLeave(): void {
    this.tooltip.set({ visible: false, x: 0, y: 0, bar: null });
  }

  onBarClick(bar: WaterfallBar): void {
    this.navigateToTask(bar.task.id);
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
      error: () => this.detailLoading.set(false),
    });
  }

  onDetailClosed(): void {
    this.showDetailPanel.set(false);
    this.selectedTaskDetail.set(null);
  }

  onEditRequested(task: TaskRead): void {
    this.showDetailPanel.set(false);
    this.formMode.set('edit');
    this.formTask.set(task);
    this.showFormPanel.set(true);
  }

  // ── Create / Edit Form ──

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
          this.loadData();
        },
        error: () => this.formSaving.set(false),
      });
    } else {
      this.taskService.createTask(data as TaskCreate).subscribe({
        next: () => {
          this.formSaving.set(false);
          this.showFormPanel.set(false);
          this.loadData();
        },
        error: () => this.formSaving.set(false),
      });
    }
  }

  // ── Export ──

  exportToPage(): void {
    const project = this.project();
    const now = new Date().toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    // ── Custom phase ordering for export ──
    const EXPORT_PHASE_ORDER: Record<string, number> = {
      'Development': 0,
      'Implementation': 1,
      'Expansion': 2,
      'Enhancements and Optimization': 3,
      'Enhancements': 3,
    };
    const sortedGroups = [...this.groups()].sort((a, b) => {
      const aOrder = EXPORT_PHASE_ORDER[a.label] ?? 99;
      const bOrder = EXPORT_PHASE_ORDER[b.label] ?? 99;
      return aOrder - bOrder;
    });

    // ── Timeline geometry (scaled to fit ~700px width) ──
    const tStart = this.timelineStart().getTime();
    const tEnd = this.timelineEnd().getTime();
    const totalMs = tEnd - tStart;
    const chartWidth = 700; // px for the timeline area
    const pxPerMs = totalMs > 0 ? chartWidth / totalMs : 0;

    const toPx = (date: Date): number =>
      Math.round((date.getTime() - tStart) * pxPerMs);

    // Month markers
    const monthMarkers: string[] = [];
    let cursor = new Date(this.timelineStart().getFullYear(), this.timelineStart().getMonth(), 1);
    const endDate = this.timelineEnd();
    while (cursor < endDate) {
      const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const left = Math.max(0, toPx(cursor));
      const right = Math.min(chartWidth, toPx(nextMonth));
      const label = cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthMarkers.push(
        `<div class="ch-month" style="left:${left}px;width:${right - left}px">
          <span class="ch-month-label">${label}</span>
        </div>`
      );
      cursor = nextMonth;
    }

    // Today marker
    const todayPx = toPx(new Date());
    const todayVisible = todayPx >= 0 && todayPx <= chartWidth;
    const todayHtml = todayVisible
      ? `<div class="ch-today" style="left:${todayPx}px"><span class="ch-today-label">TODAY</span></div>`
      : '';

    // ── Group rows (waterfall bars) ──
    const rowHeight = 38;
    const groupRows = sortedGroups.map((g, gi) => {
      // Summary bar extents
      const sLeft = g.summary.left > 0
        ? Math.round((Math.min(...g.bars.map(b => new Date(b.task.start_date!).getTime())) - tStart) * pxPerMs)
        : 0;
      const sRight = g.bars.length > 0
        ? Math.round((Math.max(...g.bars.map(b => {
            const end = b.task.due_date ?? b.task.start_date;
            return end ? new Date(end).getTime() : tStart;
          })) - tStart) * pxPerMs)
        : 0;
      const sWidth = Math.max(8, sRight - sLeft);

      // Segments
      const completedSeg = g.summary.completedPercent > 0
        ? `<div class="ch-seg ch-seg--done" style="width:${g.summary.completedPercent}%"></div>` : '';
      const progressSeg = g.summary.inProgressPercent > 0
        ? `<div class="ch-seg ch-seg--progress" style="width:${g.summary.inProgressPercent}%"></div>` : '';
      const blockedSeg = g.summary.blockedPercent > 0
        ? `<div class="ch-seg ch-seg--blocked" style="width:${g.summary.blockedPercent}%"></div>` : '';
      const pctLabel = sWidth > 60
        ? `<span class="ch-bar-pct">${g.summary.completedPercent}%</span>` : '';

      // Date labels
      const startLabel = g.bars.length > 0 ? g.summary.startLabel : '';
      const endLabel = g.bars.length > 0 ? g.summary.endLabel : '';

      // Blocked count badge
      const blockedBadge = g.summary.blockedCount > 0
        ? `<span class="lbl-stat lbl-stat--blocked">· ${g.summary.blockedCount}b</span>` : '';

      return `
        <div class="ch-row" style="top:${gi * rowHeight}px">
          <!-- Label side -->
          <div class="ch-label">
            <span class="ch-chevron">›</span>
            <span class="ch-dot" style="background:${g.color}"></span>
            <span class="ch-name">${this.escapeHtml(g.label)}</span>
            <span class="ch-count">${g.bars.length}</span>
            <span class="ch-stats">
              <span class="lbl-stat lbl-stat--done">${g.summary.completedCount}</span>
              <span class="lbl-sep">/</span>
              <span>${g.summary.totalCount}</span>
              ${blockedBadge}
            </span>
          </div>
          <!-- Bar side -->
          <div class="ch-bar-area">
            <span class="ch-date ch-date--start" style="left:${Math.max(0, sLeft - 4)}px">${startLabel}</span>
            <div class="ch-bar" style="left:${sLeft}px;width:${sWidth}px">
              ${completedSeg}${progressSeg}${blockedSeg}
              ${pctLabel}
            </div>
            <span class="ch-date ch-date--end" style="left:${sRight + 6}px">${endLabel}</span>
          </div>
        </div>`;
    }).join('');

    const chartHeight = sortedGroups.length * rowHeight;

    // ── Task list rows (compact, column-friendly) ──
    const taskListRows = sortedGroups.map(g => {
      const taskRows = g.bars.map(b => {
        const pri = (b.task.priority ?? 'medium').toLowerCase();
        const priColors: Record<string, string> = {
          critical: '#dc2626', high: '#f97316', medium: '#d97706', low: '#6b7280',
        };
        const startStr = b.task.start_date
          ? new Date(b.task.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '—';
        const endStr = b.task.due_date
          ? new Date(b.task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '—';
        return `
          <div class="tl-row">
            <span class="tl-pri" style="background:${priColors[pri] ?? '#6b7280'}"></span>
            <span class="tl-title">${this.escapeHtml(b.task.title)}</span>
            <span class="tl-chip" style="background:${b.statusColor}">${this.escapeHtml(b.statusName)}</span>
            <span class="tl-dates">${startStr} → ${endStr}</span>
          </div>`;
      }).join('');

      return `
        <div class="tl-group">
          <div class="tl-group-header">
            <span class="tl-dot" style="background:${g.color}"></span>
            <span class="tl-group-name">${this.escapeHtml(g.label)}</span>
            <span class="tl-group-count">${g.bars.length}</span>
            <span class="tl-group-pct">${g.summary.completedPercent}%</span>
          </div>
          <div class="tl-body">${taskRows}</div>
        </div>`;
    }).join('');

    // ── Assemble ──
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Waterfall Export — ${this.escapeHtml(project?.name ?? 'Project')}</title>
<link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:opsz,wght@6..12,200;6..12,300;6..12,400;6..12,600;6..12,700;6..12,800&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Nunito Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #000; color: #fff; padding: 32px 36px;
    -webkit-font-smoothing: antialiased; font-weight: 300;
  }

  /* ── Header ── */
  .hdr { margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
  .hdr-left {}
  .hdr-title { font-size: 24px; font-weight: 200; letter-spacing: 0.01em; }
  .hdr-sub { font-size: 12px; color: rgba(255,255,255,0.38); font-weight: 300; margin-top: 2px; }
  .hdr-meta { font-size: 10px; color: rgba(255,255,255,0.2); margin-top: 4px; letter-spacing: 0.02em; }

  /* ── Stats bar ── */
  .stats {
    display: inline-flex; gap: 20px; padding: 10px 20px;
    background: #111116; border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px;
  }
  .st { display: flex; align-items: baseline; gap: 5px; }
  .st-v { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
  .st-v small { font-size: 12px; font-weight: 400; color: rgba(255,255,255,0.5); }
  .st-v--blk { color: #f87171; }
  .st-l { font-size: 10px; color: rgba(255,255,255,0.35); font-weight: 300; }
  .st-d { width: 1px; align-self: stretch; background: rgba(255,255,255,0.06); }

  /* ── Waterfall chart ── */
  .chart-wrap {
    margin-bottom: 28px; background: #0b0b0f;
    border: 1px solid rgba(255,255,255,0.06); border-radius: 10px;
    overflow: hidden;
  }

  /* Month header */
  .ch-header {
    position: relative; height: 32px;
    margin-left: 260px; /* label column width */
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .ch-month {
    position: absolute; top: 0; height: 100%;
    display: flex; align-items: flex-end; padding: 0 0 6px 8px;
    border-left: 1px solid rgba(255,255,255,0.06);
  }
  .ch-month-label {
    font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.3);
    letter-spacing: 0.03em; white-space: nowrap;
  }

  /* Rows */
  .ch-body { position: relative; height: ${chartHeight}px; }
  .ch-row {
    position: absolute; left: 0; right: 0; height: ${rowHeight}px;
    display: flex; border-bottom: 1px solid rgba(255,255,255,0.03);
  }

  /* Label side */
  .ch-label {
    width: 260px; min-width: 260px; display: flex; align-items: center;
    gap: 7px; padding: 0 10px; background: #111116;
    border-right: 1px solid rgba(255,255,255,0.06);
  }
  .ch-chevron {
    font-size: 14px; color: rgba(255,255,255,0.2); font-weight: 300;
    transform: rotate(0deg); flex-shrink: 0; width: 12px; text-align: center;
  }
  .ch-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .ch-name {
    font-size: 11px; font-weight: 600; color: #fff; flex: 1;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    letter-spacing: -0.01em;
  }
  .ch-count {
    font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.2);
    background: #22222b; padding: 1px 5px; border-radius: 6px; flex-shrink: 0;
  }
  .ch-stats {
    display: flex; align-items: center; gap: 2px;
    font-size: 9px; color: rgba(255,255,255,0.3); flex-shrink: 0;
  }
  .lbl-stat--done { color: #34d399; font-weight: 600; }
  .lbl-stat--blocked { color: #f87171; font-weight: 600; }
  .lbl-sep { color: rgba(255,255,255,0.15); }

  /* Bar area */
  .ch-bar-area {
    flex: 1; position: relative; background: #0e0e13;
  }
  .ch-bar {
    position: absolute; top: 9px; height: 20px;
    border-radius: 4px; background: #22222b;
    display: flex; overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.25);
  }
  .ch-seg { height: 100%; min-width: 2px; }
  .ch-seg--done { background: #34d399; opacity: 0.85; }
  .ch-seg--progress { background: #3B82F6; opacity: 0.85; }
  .ch-seg--blocked {
    background: repeating-linear-gradient(-45deg, #EF4444, #EF4444 3px, #DC2626 3px, #DC2626 6px);
    opacity: 0.85;
  }
  .ch-bar-pct {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
    font-size: 9px; font-weight: 700; color: rgba(255,255,255,0.9);
    text-shadow: 0 1px 3px rgba(0,0,0,0.5); z-index: 1; pointer-events: none;
  }

  /* Date labels beside bars */
  .ch-date {
    position: absolute; top: 50%; transform: translateY(-50%);
    font-size: 8px; font-weight: 600; color: rgba(255,255,255,0.2);
    white-space: nowrap;
  }
  .ch-date--start { text-align: right; transform: translateY(-50%) translateX(-100%); }
  .ch-date--end {}

  /* Today line */
  .ch-today {
    position: absolute; top: 0; bottom: 0; width: 2px;
    background: #05C3DD; z-index: 10;
    margin-left: 260px; /* offset for label column */
    box-shadow: 0 0 8px rgba(5,195,221,0.3);
  }
  .ch-today-label {
    position: absolute; top: -24px; left: 50%; transform: translateX(-50%);
    font-size: 8px; font-weight: 700; color: #05C3DD;
    letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap;
    background: #0b0b0f; padding: 2px 5px; border-radius: 3px;
    border: 1px solid rgba(5,195,221,0.2);
  }

  /* Week gridlines */
  .ch-grid { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,0.025); margin-left: 260px; }

  /* ── Page break ── */
  .section-divider {
    border: none; border-top: 1px solid rgba(255,255,255,0.06);
    margin: 24px 0;
  }
  .section-title {
    font-size: 14px; font-weight: 200; color: rgba(255,255,255,0.5);
    margin-bottom: 16px; letter-spacing: 0.02em;
  }

  /* ── Task list (multi-column) ── */
  .tl-columns { columns: 3; column-gap: 14px; }
  .tl-group { margin-bottom: 6px; break-inside: avoid; }
  .tl-group-header {
    display: flex; align-items: center; gap: 5px;
    padding: 4px 8px; background: #1a1a21; border-radius: 4px 4px 0 0;
    border: 1px solid rgba(255,255,255,0.06); border-bottom: none;
  }
  .tl-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .tl-group-name { font-size: 9px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tl-group-count {
    font-size: 7px; font-weight: 600; color: rgba(255,255,255,0.2);
    background: #22222b; padding: 1px 4px; border-radius: 4px; flex-shrink: 0;
  }
  .tl-group-pct { margin-left: auto; font-size: 8px; font-weight: 600; color: #34d399; flex-shrink: 0; }

  .tl-body {
    border: 1px solid rgba(255,255,255,0.06); border-top: none;
    border-radius: 0 0 4px 4px; overflow: hidden;
  }
  .tl-row {
    display: flex; align-items: center; gap: 4px;
    padding: 2px 6px; font-size: 9px; font-weight: 300;
    color: rgba(255,255,255,0.55);
    border-bottom: 1px solid rgba(255,255,255,0.03);
  }
  .tl-row:last-child { border-bottom: none; }
  .tl-pri { width: 2px; height: 10px; border-radius: 1px; flex-shrink: 0; }
  .tl-title {
    flex: 1; min-width: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .tl-chip {
    font-size: 6px; font-weight: 700; text-transform: uppercase;
    padding: 1px 4px; border-radius: 2px; color: rgba(0,0,0,0.75);
    letter-spacing: 0.03em; white-space: nowrap; flex-shrink: 0;
  }
  .tl-dates { white-space: nowrap; font-size: 8px; color: rgba(255,255,255,0.2); flex-shrink: 0; }

  /* ── Print ── */
  @media print {
    body { background: #fff; color: #000; padding: 16px; }
    .hdr-title { color: #000; }
    .hdr-sub, .hdr-meta { color: #999; }
    .stats { background: #f5f5f5; border-color: #ddd; }
    .st-v { color: #000; } .st-v small { color: #666; }
    .st-v--blk { color: #dc2626; } .st-l { color: #999; }
    .st-d { background: #ddd; }
    .chart-wrap { background: #fafafa; border-color: #ddd; }
    .ch-header { border-color: #ddd; }
    .ch-month { border-color: #e5e5e5; }
    .ch-month-label { color: #999; }
    .ch-label { background: #f0f0f0; border-color: #ddd; }
    .ch-name { color: #000; }
    .ch-chevron { color: #bbb; }
    .ch-count { background: #e5e5e5; color: #666; }
    .ch-stats { color: #999; }
    .lbl-stat--done { color: #059669; }
    .lbl-stat--blocked { color: #dc2626; }
    .lbl-sep { color: #ccc; }
    .ch-bar-area { background: #fafafa; }
    .ch-bar { background: #e5e5e5; }
    .ch-bar-pct { color: #fff; }
    .ch-date { color: #bbb; }
    .ch-today { background: #0891b2; }
    .ch-today-label { background: #fafafa; color: #0891b2; border-color: rgba(8,145,178,0.3); }
    .ch-grid { background: rgba(0,0,0,0.04); }
    .ch-row { border-color: #eee; }
    .section-divider { border-color: #ddd; }
    .section-title { color: #666; }
    .tl-group-header { background: #f0f0f0; border-color: #ddd; }
    .tl-group-name { color: #000; }
    .tl-group-count { background: #e0e0e0; color: #555; }
    .tl-group-pct { color: #059669; }
    .tl-body { border-color: #ddd; }
    .tl-row { color: #333; border-color: #eee; }
    .tl-dates { color: #999; }
    .tl-chip { color: #fff; }
  }
</style>
</head>
<body>
  <!-- Header + Stats -->
  <div class="hdr">
    <div class="hdr-left">
      <h1 class="hdr-title">waterfall</h1>
      <p class="hdr-sub">task timeline · ${this.escapeHtml(project?.name ?? '')}</p>
      <p class="hdr-meta">${this.viewMode()} view · exported ${now}</p>
    </div>
    <div class="stats">
      <div class="st"><span class="st-v">${this.totalFiltered()}</span><span class="st-l">tasks</span></div>
      <span class="st-d"></span>
      <div class="st"><span class="st-v">${this.completionPercent()}<small>%</small></span><span class="st-l">complete</span></div>
      <span class="st-d"></span>
      <div class="st"><span class="st-v st-v--blk">${this.blockedCount()}</span><span class="st-l">blocked</span></div>
    </div>
  </div>

  <!-- Waterfall Chart -->
  <div class="chart-wrap">
    <div class="ch-header">${monthMarkers.join('')}</div>
    <div class="ch-body" style="position:relative">
      ${todayHtml}
      ${groupRows}
    </div>
  </div>

  <!-- Task List -->
  <hr class="section-divider">
  <p class="section-title">task details</p>
  <div class="tl-columns">
    ${taskListRows}
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  /** Escape HTML entities to prevent XSS in export */
  private escapeHtml(str: string): string {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  // ── Helpers ──

  getBarStatusClass(bar: WaterfallBar): string {
    const name = bar.statusName.toLowerCase().replace(/\s+/g, '-');
    return `wf__bar--${name}`;
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  formatDateFull(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  getRowOffset(groupIndex: number, barIndex: number): number {
    let row = 0;
    const groups = this.groups();
    for (let g = 0; g < groupIndex; g++) {
      row += 1; // group header
      if (!groups[g].collapsed) {
        row += groups[g].bars.length;
      }
    }
    row += 1; // current group header
    row += barIndex;
    return row * ROW_HEIGHT;
  }

  getGroupHeaderOffset(groupIndex: number): number {
    let row = 0;
    const groups = this.groups();
    for (let g = 0; g < groupIndex; g++) {
      row += 1;
      if (!groups[g].collapsed) {
        row += groups[g].bars.length;
      }
    }
    return row * ROW_HEIGHT;
  }

  // ── Data loading ──

  private loadData(): void {
    this.loading.set(true);

    this.projectService.getProjects().subscribe({
      next: (projects) => {
        if (projects.length === 0) {
          this.loading.set(false);
          return;
        }

        // Pick the project whose template matches the current view mode.
        // We fetch all templates to resolve template_id → name, then select
        // the matching project.  Falls back to first project if no match.
        this.templateService.getTemplates().subscribe({
          next: (templates) => {
            const targetName = VIEW_TEMPLATE[this.viewMode()];
            const targetTemplate = templates.find(t =>
              t.name.toLowerCase().includes(targetName.toLowerCase())
            );

            const p = targetTemplate
              ? projects.find(pr => pr.template_id === targetTemplate.id) ?? projects[0]
              : projects[0];

            forkJoin({
              project: this.projectService.getProject(p.id),
              template: this.templateService.getTemplate(p.template_id),
              tasks: this.taskService.getTasks({ project_id: p.id }),
            }).subscribe({
              next: (result) => {
                this.project.set(result.project);
                this.statuses.set(result.template.statuses);
                this.categories.set(result.template.categories);
                this.allTasks.set(result.tasks);
                this.loading.set(false);

                // Load types for form
                const templateId = result.project.template_id;
                const typeCalls = result.template.categories.map(cat =>
                  this.templateService.getTypes(templateId, cat.id)
                );
                if (typeCalls.length > 0) {
                  forkJoin(typeCalls).subscribe({
                    next: (results) => this.currentTypes.set(results.flat()),
                  });
                }
              },
              error: () => this.loading.set(false),
            });
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }
}