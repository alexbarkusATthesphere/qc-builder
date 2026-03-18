import {
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  OnInit,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';

import {
  TaskCreate,
  TaskRead,
  TaskUpdate,
  TaskPriority,
  TaskEnvironment,
} from '../../../../services/task';
import {
  StatusDefinitionRead,
  TaskCategoryRead,
  TaskTypeRead,
} from '../../../../services/template';
import { ProjectComponentRead } from '../../../../services/project';

export type TaskFormMode = 'create' | 'edit';

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './task-form.html',
  styleUrl: './task-form.css',
})
export class TaskFormComponent implements OnInit {
  // ── Inputs ──
  mode = input<TaskFormMode>('create');
  projectId = input.required<number>();
  task = input<TaskRead | null>(null);

  statuses = input<StatusDefinitionRead[]>([]);
  categories = input<TaskCategoryRead[]>([]);
  types = input<TaskTypeRead[]>([]);
  components = input<ProjectComponentRead[]>([]);

  /** Whether a save is in progress (parent controls this) */
  saving = input(false);

  // ── Outputs ──
  saved = output<TaskCreate | TaskUpdate>();
  closed = output<void>();

  // ── Local state ──
  form!: FormGroup;
  selectedCategoryId = signal<number | null>(null);

  readonly priorities: { value: TaskPriority; label: string }[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ];

  readonly environments: { value: TaskEnvironment; label: string }[] = [
    { value: 'dev', label: 'Development' },
    { value: 'test', label: 'Test' },
    { value: 'prod', label: 'Production' },
  ];

  /** Filtered types based on selected category */
  filteredTypes = computed(() => {
    const catId = this.selectedCategoryId();
    if (catId == null) return [];
    return this.types().filter((t) => t.category_id === catId);
  });

  isEdit = computed(() => this.mode() === 'edit');
  heading = computed(() => (this.isEdit() ? 'Edit Task' : 'New Task'));

  constructor(private fb: FormBuilder) {
    // Sync task input → form when editing
    effect(() => {
      const t = this.task();
      if (t && this.form) {
        this.patchForm(t);
      }
    });
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(255)]],
      description: [''],
      category_id: [null as number | null, Validators.required],
      type_id: [null as number | null],
      status_id: [null as number | null, Validators.required],
      component_id: [null as number | null],
      assignee: [''],
      priority: ['medium' as TaskPriority],
      environment: [null as TaskEnvironment | null],
      start_date: [''],
      due_date: [''],
    });

    // Track category changes to reset type
    this.form.get('category_id')?.valueChanges.subscribe((catId: number | null) => {
      this.selectedCategoryId.set(catId);
      this.form.get('type_id')?.setValue(null);
    });

    // If editing, patch form immediately
    const t = this.task();
    if (t) {
      this.patchForm(t);
    } else {
      // Set sensible defaults for create mode
      const defaultStatus = this.statuses().find((s) => s.is_default);
      if (defaultStatus) {
        this.form.get('status_id')?.setValue(defaultStatus.id);
      }
    }
  }

  // ── Actions ──

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    if (this.isEdit()) {
      const update: TaskUpdate = {};
      if (raw.title) update.title = raw.title;
      if (raw.description !== undefined) update.description = raw.description || null;
      if (raw.category_id != null) update.category_id = raw.category_id;
      update.type_id = raw.type_id ?? null;
      if (raw.status_id != null) update.status_id = raw.status_id;
      update.component_id = raw.component_id ?? null;
      update.assignee = raw.assignee || null;
      if (raw.priority) update.priority = raw.priority;
      update.environment = raw.environment ?? null;
      update.start_date = raw.start_date || null;
      update.due_date = raw.due_date || null;
      this.saved.emit(update);
    } else {
      const create: TaskCreate = {
        project_id: this.projectId(),
        title: raw.title,
        category_id: raw.category_id,
        status_id: raw.status_id,
        description: raw.description || null,
        type_id: raw.type_id ?? null,
        component_id: raw.component_id ?? null,
        assignee: raw.assignee || null,
        priority: raw.priority,
        environment: raw.environment ?? null,
        start_date: raw.start_date || null,
        due_date: raw.due_date || null,
      };
      this.saved.emit(create);
    }
  }

  close(): void {
    this.closed.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('tf__overlay')) {
      this.close();
    }
  }

  hasError(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!ctrl && ctrl.invalid && ctrl.touched;
  }

  // ── Helpers ──

  private patchForm(t: TaskRead): void {
    this.selectedCategoryId.set(t.category_id);
    this.form.patchValue({
      title: t.title,
      description: t.description ?? '',
      category_id: t.category_id,
      type_id: t.type_id,
      status_id: t.status_id,
      component_id: t.component_id,
      assignee: t.assignee ?? '',
      priority: t.priority,
      environment: t.environment,
      start_date: t.start_date ? t.start_date.substring(0, 10) : '',
      due_date: t.due_date ? t.due_date.substring(0, 10) : '',
    });
  }
}