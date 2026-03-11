// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TaskRead {
  id: number;
  project_id: number;
  category_id: number;
  type_id: number | null;
  status_id: number;
  component_id: number | null;
  title: string;
  description: string | null;
  assignee: string | null;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskDetailRead extends TaskRead {
  comments: TaskCommentRead[];
  recent_history: TaskHistoryRead[];
}

export interface TaskCreate {
  project_id: number;
  category_id: number;
  type_id?: number | null;
  status_id: number;
  component_id?: number | null;
  title: string;
  description?: string | null;
  assignee?: string | null;
  priority?: TaskPriority;
  start_date?: string | null;
  due_date?: string | null;
}

export interface TaskUpdate {
  category_id?: number;
  type_id?: number | null;
  status_id?: number;
  component_id?: number | null;
  title?: string;
  description?: string | null;
  assignee?: string | null;
  priority?: TaskPriority;
  start_date?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
}

export interface TaskSummary {
  total: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  by_category: Record<string, number>;
  by_assignee: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Task List Filters
// ---------------------------------------------------------------------------

export interface TaskListParams {
  project_id: number;
  category_id?: number;
  type_id?: number;
  status_id?: number;
  component_id?: number;
  assignee?: string;
  priority?: TaskPriority;
}

// ---------------------------------------------------------------------------
// Task Comment
// ---------------------------------------------------------------------------

export interface TaskCommentRead {
  id: number;
  task_id: number;
  author: string;
  body: string;
  created_at: string;
  updated_at: string | null;
}

export interface TaskCommentCreate {
  author: string;
  body: string;
}

export interface TaskCommentUpdate {
  body: string;
}

// ---------------------------------------------------------------------------
// Task History
// ---------------------------------------------------------------------------

export interface TaskHistoryRead {
  id: number;
  task_id: number;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  changed_at: string;
}