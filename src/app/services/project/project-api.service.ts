import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ProjectComponentCreate,
  ProjectComponentRead,
  ProjectComponentUpdate,
  ProjectCreate,
  ProjectDetailRead,
  ProjectListParams,
  ProjectRead,
  ProjectUpdate,
} from './project-api.model';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.api.v1Url}/projects`;

  // -----------------------------------------------------------------------
  // Projects
  // -----------------------------------------------------------------------

  getProjects(filters?: ProjectListParams): Observable<ProjectRead[]> {
    let params = new HttpParams();
    if (filters?.status) {
      params = params.set('status', filters.status);
    }
    if (filters?.template_id != null) {
      params = params.set('template_id', filters.template_id);
    }
    if (filters?.owner) {
      params = params.set('owner', filters.owner);
    }
    return this.http.get<ProjectRead[]>(this.base, { params });
  }

  getProject(projectId: number): Observable<ProjectDetailRead> {
    return this.http.get<ProjectDetailRead>(`${this.base}/${projectId}`);
  }

  createProject(data: ProjectCreate): Observable<ProjectRead> {
    return this.http.post<ProjectRead>(this.base, data);
  }

  updateProject(projectId: number, data: ProjectUpdate): Observable<ProjectRead> {
    return this.http.patch<ProjectRead>(`${this.base}/${projectId}`, data);
  }

  /**
   * Archives the project (soft delete). The backend sets status to ARCHIVED
   * rather than performing a hard delete.
   */
  deleteProject(projectId: number): Observable<ProjectRead> {
    return this.http.delete<ProjectRead>(`${this.base}/${projectId}`);
  }

  // -----------------------------------------------------------------------
  // Components
  // -----------------------------------------------------------------------

  getComponents(projectId: number): Observable<ProjectComponentRead[]> {
    return this.http.get<ProjectComponentRead[]>(
      `${this.base}/${projectId}/components`,
    );
  }

  createComponent(
    projectId: number,
    data: ProjectComponentCreate,
  ): Observable<ProjectComponentRead> {
    return this.http.post<ProjectComponentRead>(
      `${this.base}/${projectId}/components`,
      data,
    );
  }

  updateComponent(
    projectId: number,
    componentId: number,
    data: ProjectComponentUpdate,
  ): Observable<ProjectComponentRead> {
    return this.http.patch<ProjectComponentRead>(
      `${this.base}/${projectId}/components/${componentId}`,
      data,
    );
  }

  deleteComponent(projectId: number, componentId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/${projectId}/components/${componentId}`,
    );
  }
}