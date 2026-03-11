// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export interface TemplateRead {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateDetailRead extends TemplateRead {
  statuses: StatusDefinitionRead[];
  categories: TaskCategoryRead[];
}

export interface TemplateCreate {
  name: string;
  description?: string | null;
  is_active?: boolean;
}

export interface TemplateUpdate {
  name?: string;
  description?: string | null;
  is_active?: boolean;
}

// ---------------------------------------------------------------------------
// Status Definition
// ---------------------------------------------------------------------------

export interface StatusDefinitionRead {
  id: number;
  template_id: number;
  name: string;
  color: string | null;
  display_order: number;
  is_default: boolean;
  is_terminal: boolean;
  created_at: string;
}

export interface StatusDefinitionCreate {
  name: string;
  color?: string | null;
  display_order?: number;
  is_default?: boolean;
  is_terminal?: boolean;
}

export interface StatusDefinitionUpdate {
  name?: string;
  color?: string | null;
  display_order?: number;
  is_default?: boolean;
  is_terminal?: boolean;
}

export interface StatusReorderItem {
  id: number;
  display_order: number;
}

export interface StatusReorderRequest {
  statuses: StatusReorderItem[];
}

// ---------------------------------------------------------------------------
// Task Category
// ---------------------------------------------------------------------------

export interface TaskCategoryRead {
  id: number;
  template_id: number;
  name: string;
  description: string | null;
  display_order: number;
  icon: string | null;
  color: string | null;
  created_at: string;
}

export interface TaskCategoryCreate {
  name: string;
  description?: string | null;
  display_order?: number;
  icon?: string | null;
  color?: string | null;
}

export interface TaskCategoryUpdate {
  name?: string;
  description?: string | null;
  display_order?: number;
  icon?: string | null;
  color?: string | null;
}

// ---------------------------------------------------------------------------
// Task Type
// ---------------------------------------------------------------------------

export interface TaskTypeRead {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  display_order: number;
  created_at: string;
}

export interface TaskTypeCreate {
  name: string;
  description?: string | null;
  display_order?: number;
}

export interface TaskTypeUpdate {
  name?: string;
  description?: string | null;
  display_order?: number;
}