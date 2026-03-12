import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment as env } from '../../../environments/environment';
import {
  TaskCommentCreate,
  TaskCommentRead,
  TaskCommentUpdate,
  TaskCreate,
  TaskDetailRead,
  TaskEnvironment,
  TaskHistoryRead,
  TaskListParams,
  TaskRead,
  TaskSummary,
  TaskUpdate,
} from './task-api.model';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly base = `${env.api.v1Url}/tasks`;

  // -----------------------------------------------------------------------
  // Tasks
  // -----------------------------------------------------------------------

  getTasks(filters: TaskListParams): Observable<TaskRead[]> {
    let params = new HttpParams().set('project_id', filters.project_id);
    if (filters.category_id != null) {
      params = params.set('category_id', filters.category_id);
    }
    if (filters.type_id != null) {
      params = params.set('type_id', filters.type_id);
    }
    if (filters.status_id != null) {
      params = params.set('status_id', filters.status_id);
    }
    if (filters.component_id != null) {
      params = params.set('component_id', filters.component_id);
    }
    if (filters.assignee) {
      params = params.set('assignee', filters.assignee);
    }
    if (filters.priority) {
      params = params.set('priority', filters.priority);
    }
    if (filters.environment) {
      params = params.set('environment', filters.environment);
    }
    return this.http.get<TaskRead[]>(this.base, { params });
  }

  getTask(taskId: number): Observable<TaskDetailRead> {
    return this.http.get<TaskDetailRead>(`${this.base}/${taskId}`);
  }

  getTaskSummary(
    projectId: number,
    environment?: TaskEnvironment,
  ): Observable<TaskSummary> {
    let params = new HttpParams().set('project_id', projectId);
    if (environment) {
      params = params.set('environment', environment);
    }
    return this.http.get<TaskSummary>(`${this.base}/summary`, { params });
  }

  createTask(data: TaskCreate): Observable<TaskRead> {
    return this.http.post<TaskRead>(this.base, data);
  }

  updateTask(taskId: number, data: TaskUpdate): Observable<TaskRead> {
    return this.http.patch<TaskRead>(`${this.base}/${taskId}`, data);
  }

  deleteTask(taskId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${taskId}`);
  }

  // -----------------------------------------------------------------------
  // Task History
  // -----------------------------------------------------------------------

  getTaskHistory(taskId: number): Observable<TaskHistoryRead[]> {
    return this.http.get<TaskHistoryRead[]>(
      `${this.base}/${taskId}/history`,
    );
  }

  // -----------------------------------------------------------------------
  // Task Comments
  // -----------------------------------------------------------------------

  getComments(taskId: number): Observable<TaskCommentRead[]> {
    return this.http.get<TaskCommentRead[]>(
      `${this.base}/${taskId}/comments`,
    );
  }

  createComment(
    taskId: number,
    data: TaskCommentCreate,
  ): Observable<TaskCommentRead> {
    return this.http.post<TaskCommentRead>(
      `${this.base}/${taskId}/comments`,
      data,
    );
  }

  updateComment(
    taskId: number,
    commentId: number,
    data: TaskCommentUpdate,
  ): Observable<TaskCommentRead> {
    return this.http.patch<TaskCommentRead>(
      `${this.base}/${taskId}/comments/${commentId}`,
      data,
    );
  }

  deleteComment(taskId: number, commentId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/${taskId}/comments/${commentId}`,
    );
  }
}