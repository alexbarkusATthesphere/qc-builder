// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export type ProjectStatus = 'active' | 'on_hold' | 'complete' | 'archived';

export interface ProjectRead {
  id: number;
  template_id: number;
  name: string;
  description: string | null;
  owner: string | null;
  status: ProjectStatus;
  start_date: string | null;
  target_end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetailRead extends ProjectRead {
  components: ProjectComponentRead[];
  task_count: number;
  tasks_by_status: Record<string, number>;
}

export interface ProjectCreate {
  template_id: number;
  name: string;
  description?: string | null;
  owner?: string | null;
  status?: ProjectStatus;
  start_date?: string | null;
  target_end_date?: string | null;
}

export interface ProjectUpdate {
  template_id?: number;
  name?: string;
  description?: string | null;
  owner?: string | null;
  status?: ProjectStatus;
  start_date?: string | null;
  target_end_date?: string | null;
}

// ---------------------------------------------------------------------------
// Project Component
// ---------------------------------------------------------------------------

export interface ProjectComponentRead {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  display_order: number;
  created_at: string;
}

export interface ProjectComponentCreate {
  name: string;
  description?: string | null;
  display_order?: number;
}

export interface ProjectComponentUpdate {
  name?: string;
  description?: string | null;
  display_order?: number;
}

// ---------------------------------------------------------------------------
// Project List Filters
// ---------------------------------------------------------------------------

export interface ProjectListParams {
  status?: ProjectStatus;
  template_id?: number;
  owner?: string;
}