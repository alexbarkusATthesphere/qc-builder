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

interface TimelineYear {
  year: number;
  label: string;
  left: number;
  width: number;
}

interface TimelineQuarter {
  label: string;   // Q1, Q2, Q3, Q4
  year: number;
  left: number;
  width: number;
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

/** Milestone marker — rendered as a vertical line (like Today) */
interface MilestoneMarker {
  task: TaskRead;
  px: number;
  label: string;
  shortLabel: string;
  color: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_PX = 6;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 90;
const YEAR_ROW_H = 20;
const QUARTER_ROW_H = 22;
const MONTH_ROW_H = 24;
const EVENT_ROW_H = 24;

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

  /** Year markers for the top tier of the timeline header */
  timelineYears = computed<TimelineYear[]>(() => {
    const start = this.timelineStart();
    const end = this.timelineEnd();
    const years: TimelineYear[] = [];

    let year = start.getFullYear();
    while (new Date(year, 0, 1) < end) {
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year + 1, 0, 1);
      const left = Math.max(0, this.dateToPx(yearStart));
      const right = Math.min(this.timelineWidth(), this.dateToPx(yearEnd));
      if (right > left) {
        years.push({ year, label: String(year), left, width: right - left });
      }
      year++;
    }
    return years;
  });

  /** Quarter markers for the middle tier of the timeline header */
  timelineQuarters = computed<TimelineQuarter[]>(() => {
    const start = this.timelineStart();
    const end = this.timelineEnd();
    const quarters: TimelineQuarter[] = [];

    let year = start.getFullYear();
    let q = Math.floor(start.getMonth() / 3);  // 0-based quarter index

    while (true) {
      const qStart = new Date(year, q * 3, 1);
      if (qStart >= end) break;
      const qEnd = new Date(year, (q + 1) * 3, 1);
      const left = Math.max(0, this.dateToPx(qStart));
      const right = Math.min(this.timelineWidth(), this.dateToPx(qEnd));
      if (right > left) {
        quarters.push({ label: `Q${q + 1}`, year, left, width: right - left });
      }
      q++;
      if (q > 3) { q = 0; year++; }
    }
    return quarters;
  });

  /** Month markers for the bottom tier of the timeline header */
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
        label: cursor.toLocaleDateString('en-US', { month: 'short' }),
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

  /** IDs of task-types that should render as milestone markers */
  milestoneTypeIds = computed<Set<number>>(() => {
    return new Set(
      this.currentTypes()
        .filter((t: any) => t.name === 'Staffing & Headcount')
        .map((t: any) => t.id),
    );
  });

  /** Milestone markers — vertical lines on the timeline (hiring events, etc.) */
  milestones = computed<MilestoneMarker[]>(() => {
    const typeIds = this.milestoneTypeIds();
    return this.filteredTasks()
      .filter(t => {
        // Match by type_id if available, otherwise fall back to title pattern
        if (typeIds.size > 0 && (t as any).type_id && typeIds.has((t as any).type_id)) return true;
        return /^Hire \d+ Junior Developer/i.test(t.title);
      })
      .filter(t => t.start_date)
      .map(t => {
        const px = this.dateToPx(new Date(t.start_date!));
        return {
          task: t,
          px,
          label: t.title,
          shortLabel: t.title.includes('2 Junior') ? 'Hire 2 Jr Devs' : 'Hire 1 Jr Dev',
          color: '#F59E0B',
        };
      })
      .filter(m => m.px >= 0 && m.px <= this.timelineWidth());
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

    // Group bars (exclude milestone tasks — they render as vertical lines)
    const groupBy = this.groupBy();
    const groupMap = new Map<string, WaterfallBar[]>();
    const milestoneTypeIds = this.milestoneTypeIds();

    for (const bar of bars) {
      // Skip milestones — they are rendered separately as vertical marker lines
      if (milestoneTypeIds.size > 0 && (bar.task as any).type_id && milestoneTypeIds.has((bar.task as any).type_id)) continue;
      if (/^Hire \d+ Junior Developer/i.test(bar.task.title)) continue;
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

    // ── Timeline geometry (percentage-based to fill container) ──
    const tStart = this.timelineStart().getTime();
    const tEnd = this.timelineEnd().getTime();
    const totalMs = tEnd - tStart;

    /** Convert a Date to a percentage position within the timeline */
    const toPct = (date: Date): number =>
      totalMs > 0 ? ((date.getTime() - tStart) / totalMs) * 100 : 0;

    // ── Filter milestone tasks out of groups ──
    const milestoneTypeIds = this.milestoneTypeIds();
    const isMilestone = (t: TaskRead): boolean => {
      if (milestoneTypeIds.size > 0 && (t as any).type_id && milestoneTypeIds.has((t as any).type_id)) return true;
      return /^Hire \d+ Junior Developer/i.test(t.title);
    };
    let exportGroups = sortedGroups.map(g => ({
      ...g,
      bars: g.bars.filter(b => !isMilestone(b.task)),
    }));

    // ── Compute Scale sub-bar data (3 colored bars within one Scale row) ──
    const SCALE_SUBGROUP_MAP: Record<string, string> = {
      'Guest Services Rollout': 'GS & Building Ops',
      'Building Operations Rollout': 'GS & Building Ops',
      'Food & Beverage Rollout': 'Food & Beverage',
    };
    const SCALE_SUBGROUP_COLORS: Record<string, string> = {
      'GS & Building Ops': '#34d399',
      'System Expansion': '#EC4899',
      'Food & Beverage': '#a78bfa',
    };
    const SCALE_SUBGROUP_ORDER: Record<string, number> = {
      'GS & Building Ops': 0,
      'Food & Beverage': 1,
      'System Expansion': 2,
    };

    // Build type_id → type name lookup from loaded types
    const typeNameMap = new Map<number, string>(
      this.currentTypes().map((t: any) => [t.id, t.name])
    );

    type ScaleSubBar = {
      label: string;
      color: string;
      leftPct: number;
      widthPct: number;
      taskCount: number;
      completedCount: number;
      startDate: string;
      endDate: string;
    }
    let scaleSubBars: ScaleSubBar[] = [];

    const scaleGroup = exportGroups.find(g => g.label === 'Scale');
    if (scaleGroup) {
      const subGroupBars = new Map<string, WaterfallBar[]>();
      for (const bar of scaleGroup.bars) {
        const typeId = (bar.task as any).type_id as number | undefined;
        const typeName = typeId ? (typeNameMap.get(typeId) ?? '') : '';
        const subLabel = SCALE_SUBGROUP_MAP[typeName] ?? 'System Expansion';
        if (!subGroupBars.has(subLabel)) subGroupBars.set(subLabel, []);
        subGroupBars.get(subLabel)!.push(bar);
      }

      scaleSubBars = Array.from(subGroupBars.entries())
        .sort((a, b) => (SCALE_SUBGROUP_ORDER[a[0]] ?? 99) - (SCALE_SUBGROUP_ORDER[b[0]] ?? 99))
        .map(([label, bars]) => {
          const dated = bars.filter(b => b.task.start_date);
          const startDates = dated.map(b => b.task.start_date!).sort();
          const endDates = dated.map(b => b.task.due_date ?? b.task.start_date!).sort().reverse();
          const minMs = dated.length > 0 ? Math.min(...dated.map(b => new Date(b.task.start_date!).getTime())) : tStart;
          const maxMs = dated.length > 0 ? Math.max(...dated.map(b => {
            const end = b.task.due_date ?? b.task.start_date;
            return end ? new Date(end).getTime() : tStart;
          })) : tStart;
          return {
            label,
            color: SCALE_SUBGROUP_COLORS[label] ?? '#EC4899',
            leftPct: totalMs > 0 ? ((minMs - tStart) / totalMs) * 100 : 0,
            widthPct: totalMs > 0 ? Math.max(0.5, ((maxMs - minMs) / totalMs) * 100) : 0,
            taskCount: bars.length,
            completedCount: bars.filter(b => b.isCompleted).length,
            startDate: startDates[0] ?? '',
            endDate: endDates[0] ?? '',
          };
        });
    }

    // Recompute summary counts after filtering
    const blockedId = this.statuses().find(s => s.name === 'Blocked')?.id;
    const inProgressId = this.statuses().find(s => s.name === 'In Progress')?.id;
    const inReviewId = this.statuses().find(s => s.name === 'In Review')?.id;
    const terminalIds = new Set(this.statuses().filter(s => s.is_terminal).map(s => s.id));

    for (const g of exportGroups) {
      const totalCount = g.bars.length;
      const completedCount = g.bars.filter(b => b.isCompleted).length;
      const bCount = blockedId ? g.bars.filter(b => b.task.status_id === blockedId).length : 0;
      const ipCount = g.bars.filter(b =>
        b.task.status_id === inProgressId || b.task.status_id === inReviewId
      ).length;

      // Recompute date labels from bars
      const startDates = g.bars
        .map(b => b.task.start_date).filter(Boolean) as string[];
      const endDates = g.bars
        .map(b => b.task.due_date ?? b.task.start_date).filter(Boolean) as string[];
      const minDate = startDates.length > 0 ? startDates.sort()[0] : '';
      const maxDate = endDates.length > 0 ? endDates.sort().reverse()[0] : '';
      const fmtShort = (d: string) => d
        ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '—';

      (g as any).summary = {
        ...g.summary,
        totalCount,
        completedCount,
        blockedCount: bCount,
        inProgressCount: ipCount,
        completedPercent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
        blockedPercent: totalCount > 0 ? Math.round((bCount / totalCount) * 100) : 0,
        inProgressPercent: totalCount > 0 ? Math.round((ipCount / totalCount) * 100) : 0,
        startLabel: fmtShort(minDate),
        endLabel: fmtShort(maxDate),
      };
    }

    // ── Milestone markers for export ──
    const exportMilestones = this.filteredTasks()
      .filter(t => isMilestone(t) && t.start_date)
      .map(t => ({
        pct: toPct(new Date(t.start_date!)),
        label: t.title,
        shortLabel: t.title.includes('2 Junior') ? 'Hire 2 Jr Devs' : 'Hire 1 Jr Dev',
      }))
      .filter(m => m.pct >= 0 && m.pct <= 100);

    // ── Three-tier + events timeline header: Year → Quarter → Month → Events ──
    const endDate = this.timelineEnd();
    const yearMarkers: string[] = [];
    const quarterMarkers: string[] = [];
    const monthMarkers: string[] = [];

    // Years (centered labels)
    let yearCursor = this.timelineStart().getFullYear();
    while (new Date(yearCursor, 0, 1) < endDate) {
      const yStart = new Date(yearCursor, 0, 1);
      const yEnd = new Date(yearCursor + 1, 0, 1);
      const left = Math.max(0, toPct(yStart));
      const right = Math.min(100, toPct(yEnd));
      if (right > left) {
        yearMarkers.push(
          `<div class="ch-year" style="left:${left}%;width:${right - left}%">
            <span class="ch-year-label">${yearCursor}</span>
          </div>`
        );
      }
      yearCursor++;
    }

    // Quarters
    let qYear = this.timelineStart().getFullYear();
    let qIdx = Math.floor(this.timelineStart().getMonth() / 3);
    while (true) {
      const qStart = new Date(qYear, qIdx * 3, 1);
      if (qStart >= endDate) break;
      const qEnd = new Date(qYear, (qIdx + 1) * 3, 1);
      const left = Math.max(0, toPct(qStart));
      const right = Math.min(100, toPct(qEnd));
      if (right > left) {
        quarterMarkers.push(
          `<div class="ch-quarter" style="left:${left}%;width:${right - left}%">
            <span class="ch-quarter-label">Q${qIdx + 1}</span>
          </div>`
        );
      }
      qIdx++;
      if (qIdx > 3) { qIdx = 0; qYear++; }
    }

    // Months
    let cursor = new Date(this.timelineStart().getFullYear(), this.timelineStart().getMonth(), 1);
    while (cursor < endDate) {
      const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const left = Math.max(0, toPct(cursor));
      const right = Math.min(100, toPct(nextMonth));
      const label = cursor.toLocaleDateString('en-US', { month: 'short' });
      monthMarkers.push(
        `<div class="ch-month" style="left:${left}%;width:${right - left}%">
          <span class="ch-month-label">${label}</span>
        </div>`
      );
      cursor = nextMonth;
    }

    // Events tier (Today + milestone markers)
    const todayPct = toPct(new Date());
    const todayVisible = todayPct >= 0 && todayPct <= 100;
    const eventMarkers: string[] = [];
    if (todayVisible) {
      eventMarkers.push(
        `<span class="ch-event-label ch-event-label--today" style="left:${todayPct}%">TODAY</span>`
      );
    }
    for (const m of exportMilestones) {
      eventMarkers.push(
        `<span class="ch-event-label ch-event-label--milestone" style="left:${m.pct}%">${this.escapeHtml(m.shortLabel)}</span>`
      );
    }

    // Today line + milestone lines in body
    const todayHtml = todayVisible
      ? `<div class="ch-today" style="left:${todayPct}%"></div>`
      : '';
    const milestoneLines = exportMilestones.map(m =>
      `<div class="ch-milestone" style="left:${m.pct}%"></div>`
    ).join('');

    // ── Group rows (waterfall bars) ──
    const rowHeight = 38;
    const scaleSubRowH = 32;  // height of each sub-row inside Scale
    const scaleHeaderH = 30;  // Scale group header row
    const scaleContainerH = scaleHeaderH + scaleSubBars.length * scaleSubRowH;

    /** Get the total height for a group */
    const groupHeight = (g: typeof exportGroups[0]) =>
      g.label === 'Scale' && scaleSubBars.length > 0 ? scaleContainerH : rowHeight;

    const groupRows = exportGroups.map((g, gi) => {
      // Compute top offset
      let rowTop = 0;
      for (let i = 0; i < gi; i++) rowTop += groupHeight(exportGroups[i]);

      // Summary bar extents (percentages)
      const datedBars = g.bars.filter(b => b.task.start_date);
      const sLeftPct = datedBars.length > 0
        ? Math.max(0, toPct(new Date(Math.min(...datedBars.map(b => new Date(b.task.start_date!).getTime())))))
        : 0;
      const sRightPct = datedBars.length > 0
        ? Math.min(100, toPct(new Date(Math.max(...datedBars.map(b => {
            const end = b.task.due_date ?? b.task.start_date;
            return end ? new Date(end).getTime() : tStart;
          })))))
        : 0;
      const sWidthPct = Math.max(0.5, sRightPct - sLeftPct);

      // Blocked count badge
      const blockedBadge = g.summary.blockedCount > 0
        ? `<span class="lbl-stat lbl-stat--blocked">· ${g.summary.blockedCount}b</span>` : '';

      // ── Scale: vertical container with header + 3 sub-rows ──
      if (g.label === 'Scale' && scaleSubBars.length > 0) {
        const fmtDate = (d: string) => d
          ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '';

        const subRowsHtml = scaleSubBars.map((sb, si) => {
          const pct = sb.taskCount > 0 ? Math.round((sb.completedCount / sb.taskCount) * 100) : 0;
          const pctText = sb.widthPct > 3 ? `<span class="ch-bar-pct">${pct}%</span>` : '';
          const barRight = sb.leftPct + sb.widthPct;
          return `
            <div class="sc-sub-row" style="top:${scaleHeaderH + si * scaleSubRowH}px;height:${scaleSubRowH}px">
              <div class="sc-sub-label">
                <span class="sc-sub-dot" style="background:${sb.color}"></span>
                <span class="sc-sub-name">${this.escapeHtml(sb.label)}</span>
                <span class="sc-sub-count">${sb.taskCount}</span>
              </div>
              <div class="ch-bar-area">
                <span class="ch-date ch-date--start" style="left:${Math.max(0, sb.leftPct - 0.3)}%">${fmtDate(sb.startDate)}</span>
                <div class="ch-bar ch-bar--sub" style="left:${sb.leftPct}%;width:${sb.widthPct}%;background:${sb.color}">
                  ${pctText}
                </div>
                <span class="ch-date ch-date--end" style="left:${barRight + 0.3}%">${fmtDate(sb.endDate)}</span>
              </div>
            </div>`;
        }).join('');

        return `
          <div class="ch-row ch-row--scale" style="top:${rowTop}px;height:${scaleContainerH}px">
            <!-- Scale header -->
            <div class="sc-header" style="height:${scaleHeaderH}px">
              <div class="ch-label" style="height:${scaleHeaderH}px">
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
              <div class="ch-bar-area"></div>
            </div>
            <!-- Sub-rows -->
            ${subRowsHtml}
          </div>`;
      }

      // ── Standard single summary bar ──
      const completedSeg = g.summary.completedPercent > 0
        ? `<div class="ch-seg ch-seg--done" style="width:${g.summary.completedPercent}%"></div>` : '';
      const progressSeg = g.summary.inProgressPercent > 0
        ? `<div class="ch-seg ch-seg--progress" style="width:${g.summary.inProgressPercent}%"></div>` : '';
      const blockedSeg = g.summary.blockedPercent > 0
        ? `<div class="ch-seg ch-seg--blocked" style="width:${g.summary.blockedPercent}%"></div>` : '';
      const pctLabel = sWidthPct > 4
        ? `<span class="ch-bar-pct">${g.summary.completedPercent}%</span>` : '';
      const startLabel = datedBars.length > 0 ? g.summary.startLabel : '';
      const endLabel = datedBars.length > 0 ? g.summary.endLabel : '';

      return `
        <div class="ch-row" style="top:${rowTop}px;height:${rowHeight}px">
          <div class="ch-label" style="height:${rowHeight}px">
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
          <div class="ch-bar-area">
            <span class="ch-date ch-date--start" style="left:${Math.max(0, sLeftPct - 0.3)}%">${startLabel}</span>
            <div class="ch-bar" style="left:${sLeftPct}%;width:${sWidthPct}%">
              ${completedSeg}${progressSeg}${blockedSeg}
              ${pctLabel}
            </div>
            <span class="ch-date ch-date--end" style="left:${sRightPct + 0.4}%">${endLabel}</span>
          </div>
        </div>`;
    }).join('');

    // Compute total chart height
    let chartHeight = 0;
    for (const g of exportGroups) chartHeight += groupHeight(g);

    // Remove the old scale legend — sub-rows now have their own labels
    const scaleLegend = '';

    // ── Task list rows (compact, column-friendly) ──
    const taskListRows = exportGroups.map(g => {
      const pri2color: Record<string, string> = {
        critical: '#dc2626', high: '#f97316', medium: '#d97706', low: '#6b7280',
      };
      const renderTaskRow = (b: WaterfallBar) => {
        const pri = (b.task.priority ?? 'medium').toLowerCase();
        const startStr = b.task.start_date
          ? new Date(b.task.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '—';
        const endStr = b.task.due_date
          ? new Date(b.task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '—';
        return `
          <div class="tl-row">
            <span class="tl-pri" style="background:${pri2color[pri] ?? '#6b7280'}"></span>
            <span class="tl-title">${this.escapeHtml(b.task.title)}</span>
            <span class="tl-chip" style="background:${b.statusColor}">${this.escapeHtml(b.statusName)}</span>
            <span class="tl-dates">${startStr} → ${endStr}</span>
          </div>`;
      };

      // For Scale: split tasks by sub-group with colored sub-headers
      if (g.label === 'Scale' && scaleSubBars.length > 0) {
        const subGroupBars = new Map<string, WaterfallBar[]>();
        for (const bar of g.bars) {
          const typeId = (bar.task as any).type_id as number | undefined;
          const typeName = typeId ? (typeNameMap.get(typeId) ?? '') : '';
          const subLabel = SCALE_SUBGROUP_MAP[typeName] ?? 'System Expansion';
          if (!subGroupBars.has(subLabel)) subGroupBars.set(subLabel, []);
          subGroupBars.get(subLabel)!.push(bar);
        }
        const subSections = scaleSubBars.map(sb => {
          const bars = subGroupBars.get(sb.label) ?? [];
          return `
            <div class="tl-sub-header">
              <span class="tl-dot" style="background:${sb.color}"></span>
              <span class="tl-sub-name">${this.escapeHtml(sb.label)}</span>
              <span class="tl-group-count">${sb.taskCount}</span>
            </div>
            ${bars.map(renderTaskRow).join('')}`;
        }).join('');

        return `
          <div class="tl-group">
            <div class="tl-group-header">
              <span class="tl-dot" style="background:${g.color}"></span>
              <span class="tl-group-name">${this.escapeHtml(g.label)}</span>
              <span class="tl-group-count">${g.bars.length}</span>
              <span class="tl-group-pct">${g.summary.completedPercent}%</span>
            </div>
            <div class="tl-body">${subSections}</div>
          </div>`;
      }

      // Standard group
      const taskRows = g.bars.map(renderTaskRow).join('');

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

  /* Three-tier timeline header */
  .ch-header-stack {
    margin-left: 260px; /* label column width */
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .ch-header {
    position: relative;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .ch-header:last-child { border-bottom: none; }
  .ch-header--year { height: 20px; background: rgba(255,255,255,0.02); }
  .ch-header--quarter { height: 20px; }
  .ch-header--month { height: 22px; }
  .ch-header--events {
    height: 22px; position: relative;
    border-top: 1px solid rgba(255,255,255,0.04);
  }

  .ch-year {
    position: absolute; top: 0; height: 100%;
    display: flex; align-items: center; justify-content: center;
    border-left: 1px solid rgba(255,255,255,0.08);
  }
  .ch-year-label {
    font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.5);
    letter-spacing: 0.04em; white-space: nowrap;
  }
  .ch-quarter {
    position: absolute; top: 0; height: 100%;
    display: flex; align-items: center; padding: 0 0 0 6px;
    border-left: 1px solid rgba(255,255,255,0.06);
  }
  .ch-quarter-label {
    font-size: 8px; font-weight: 600; color: rgba(255,255,255,0.35);
    letter-spacing: 0.04em; white-space: nowrap;
  }
  .ch-month {
    position: absolute; top: 0; height: 100%;
    display: flex; align-items: center; padding: 0 0 0 4px;
    border-left: 1px solid rgba(255,255,255,0.04);
  }
  .ch-month-label {
    font-size: 7px; font-weight: 500; color: rgba(255,255,255,0.25);
    letter-spacing: 0.02em; white-space: nowrap;
  }

  /* Event labels (4th tier) */
  .ch-event-label {
    position: absolute; top: 50%; transform: translate(-50%, -50%);
    font-size: 7px; font-weight: 700; letter-spacing: 0.06em;
    text-transform: uppercase; white-space: nowrap;
    padding: 2px 5px; border-radius: 3px;
  }
  .ch-event-label--today {
    color: #05C3DD; background: rgba(5,195,221,0.1);
    border: 1px solid rgba(5,195,221,0.2);
  }
  .ch-event-label--milestone {
    color: #F59E0B; background: rgba(245,158,11,0.1);
    border: 1px solid rgba(245,158,11,0.2);
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

  /* Scale container — vertical stack of header + sub-rows */
  .ch-row--scale {
    display: block; /* override flex so sub-rows stack */
    position: absolute; left: 0; right: 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .sc-header {
    display: flex; width: 100%;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .sc-sub-row {
    position: absolute; left: 0; right: 0;
    display: flex;
    border-bottom: 1px solid rgba(255,255,255,0.025);
  }
  .sc-sub-label {
    width: 260px; min-width: 260px; display: flex; align-items: center;
    gap: 5px; padding: 0 10px 0 30px;
    background: #111116;
    border-right: 1px solid rgba(255,255,255,0.06);
  }
  .sc-sub-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .sc-sub-name {
    font-size: 9px; font-weight: 500; color: rgba(255,255,255,0.55);
    flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    letter-spacing: -0.01em;
  }
  .sc-sub-count {
    font-size: 7px; font-weight: 600; color: rgba(255,255,255,0.2);
    background: #22222b; padding: 1px 4px; border-radius: 4px; flex-shrink: 0;
  }

  /* Sub-bar styling (positioned within its own row) */
  .ch-bar--sub {
    position: absolute; top: 6px; height: 20px;
    border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.25);
  }

  /* Task list sub-group header (within Scale) */
  .tl-sub-header {
    display: flex; align-items: center; gap: 4px;
    padding: 3px 8px 2px; margin-top: 2px;
    font-size: 8px; font-weight: 600; color: rgba(255,255,255,0.4);
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .tl-sub-name {
    font-size: 7px; font-weight: 600; letter-spacing: 0.03em;
    text-transform: uppercase; color: rgba(255,255,255,0.35);
  }

  /* Date labels beside bars */
  .ch-date {
    position: absolute; top: 50%; transform: translateY(-50%);
    font-size: 8px; font-weight: 600; color: rgba(255,255,255,0.2);
    white-space: nowrap;
  }
  .ch-date--start { text-align: right; transform: translateY(-50%) translateX(-100%); }
  .ch-date--end {}

  /* Lines wrapper — spans the bar area only */
  .ch-lines {
    position: absolute; top: 0; bottom: 0;
    left: 260px; right: 0;
    pointer-events: none; z-index: 10;
  }

  /* Today line */
  .ch-today {
    position: absolute; top: 0; bottom: 0; width: 2px;
    background: #05C3DD; z-index: 10;
    box-shadow: 0 0 8px rgba(5,195,221,0.3);
  }

  /* Milestone line */
  .ch-milestone {
    position: absolute; top: 0; bottom: 0; width: 2px;
    z-index: 9;
    box-shadow: 0 0 8px rgba(245,158,11,0.25);
    opacity: 0.7;
    background-image: repeating-linear-gradient(
      to bottom,
      #F59E0B 0, #F59E0B 6px,
      transparent 6px, transparent 10px
    );
    background-color: transparent;
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
    .ch-header-stack { border-color: #ddd; }
    .ch-header { border-color: #e5e5e5; }
    .ch-header--year { background: #f5f5f5; }
    .ch-year { border-color: #ccc; }
    .ch-year-label { color: #333; }
    .ch-quarter { border-color: #ddd; }
    .ch-quarter-label { color: #666; }
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
    .ch-event-label--today { background: #fafafa; color: #0891b2; border-color: rgba(8,145,178,0.3); }
    .ch-event-label--milestone { background: #fafafa; color: #b45309; border-color: rgba(180,83,9,0.3); }
    .ch-milestone { background-image: repeating-linear-gradient(to bottom, #b45309 0, #b45309 6px, transparent 6px, transparent 10px); }
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
    .sc-sub-label { background: #f5f5f5; border-color: #ddd; }
    .sc-sub-name { color: #333; }
    .sc-sub-count { background: #e0e0e0; color: #555; }
    .sc-sub-row { border-color: #eee; }
    .sc-header { border-color: #ddd; }
    .ch-bar--sub .ch-bar-pct { color: #fff; }
    .tl-sub-header { border-color: #eee; }
    .tl-sub-name { color: #666; }
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
    <div class="ch-header-stack">
      <div class="ch-header ch-header--year">${yearMarkers.join('')}</div>
      <div class="ch-header ch-header--quarter">${quarterMarkers.join('')}</div>
      <div class="ch-header ch-header--month">${monthMarkers.join('')}</div>
      <div class="ch-header ch-header--events">${eventMarkers.join('')}</div>
    </div>
    <div class="ch-body" style="position:relative">
      <div class="ch-lines">
        ${todayHtml}
        ${milestoneLines}
      </div>
      ${groupRows}
    </div>
  </div>

  ${scaleLegend}

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