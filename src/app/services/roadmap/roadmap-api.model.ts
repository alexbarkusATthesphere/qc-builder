/**
 * Roadmap summary models.
 *
 * Location: app/core/api/roadmap-api/roadmap-api.model.ts
 */

import { TaskEnvironment, TaskPriority } from '../task';

// ---------------------------------------------------------------------------
// Phase-level task (slimmed-down read for executive view)
// ---------------------------------------------------------------------------

export interface RoadmapTaskRead {
  id: number;
  title: string;
  description: string | null;
  type_name: string | null;
  component_name: string | null;
  status: string;
  priority: TaskPriority;
  environment: TaskEnvironment | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
}

// ---------------------------------------------------------------------------
// Status breakdown (shared at phase and overall level)
// ---------------------------------------------------------------------------

export interface StatusBreakdown {
  complete: number;
  in_progress: number;
  in_review: number;
  blocked: number;
  not_started: number;
  /** Server-computed */
  total: number;
  /** Server-computed (0–100) */
  percent_complete: number;
}

// ---------------------------------------------------------------------------
// Single roadmap phase (one of the four categories)
// ---------------------------------------------------------------------------

export interface RoadmapPhaseRead {
  category_id: number;
  name: string;
  description: string | null;
  display_order: number;
  icon: string | null;
  color: string | null;
  progress: StatusBreakdown;
  earliest_start: string | null;
  latest_due: string | null;
  tasks: RoadmapTaskRead[];
}

// ---------------------------------------------------------------------------
// Top-level roadmap summary response
// ---------------------------------------------------------------------------

export interface RoadmapSummaryRead {
  project_id: number;
  project_name: string;
  template_id: number;
  progress: StatusBreakdown;
  phases: RoadmapPhaseRead[];
}

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

export interface RoadmapSummaryParams {
  environment?: TaskEnvironment;
}