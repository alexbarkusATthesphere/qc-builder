import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  StatusDefinitionCreate,
  StatusDefinitionRead,
  StatusDefinitionUpdate,
  StatusReorderItem,
  TaskCategoryCreate,
  TaskCategoryRead,
  TaskCategoryUpdate,
  TaskTypeCreate,
  TaskTypeRead,
  TaskTypeUpdate,
  TemplateCreate,
  TemplateDetailRead,
  TemplateRead,
  TemplateUpdate,
} from './template-api.model';

@Injectable({ providedIn: 'root' })
export class TemplateService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.api.v1Url}/templates`;

  // -----------------------------------------------------------------------
  // Templates
  // -----------------------------------------------------------------------

  getTemplates(activeOnly = true): Observable<TemplateRead[]> {
    const params = new HttpParams().set('active_only', activeOnly);
    return this.http.get<TemplateRead[]>(this.base, { params });
  }

  getTemplate(templateId: number): Observable<TemplateDetailRead> {
    return this.http.get<TemplateDetailRead>(`${this.base}/${templateId}`);
  }

  createTemplate(data: TemplateCreate): Observable<TemplateRead> {
    return this.http.post<TemplateRead>(this.base, data);
  }

  updateTemplate(templateId: number, data: TemplateUpdate): Observable<TemplateRead> {
    return this.http.patch<TemplateRead>(`${this.base}/${templateId}`, data);
  }

  deleteTemplate(templateId: number): Observable<TemplateRead> {
    return this.http.delete<TemplateRead>(`${this.base}/${templateId}`);
  }

  // -----------------------------------------------------------------------
  // Status Definitions
  // -----------------------------------------------------------------------

  getStatuses(templateId: number): Observable<StatusDefinitionRead[]> {
    return this.http.get<StatusDefinitionRead[]>(
      `${this.base}/${templateId}/statuses`,
    );
  }

  createStatus(
    templateId: number,
    data: StatusDefinitionCreate,
  ): Observable<StatusDefinitionRead> {
    return this.http.post<StatusDefinitionRead>(
      `${this.base}/${templateId}/statuses`,
      data,
    );
  }

  updateStatus(
    templateId: number,
    statusId: number,
    data: StatusDefinitionUpdate,
  ): Observable<StatusDefinitionRead> {
    return this.http.patch<StatusDefinitionRead>(
      `${this.base}/${templateId}/statuses/${statusId}`,
      data,
    );
  }

  deleteStatus(templateId: number, statusId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/${templateId}/statuses/${statusId}`,
    );
  }

  reorderStatuses(
    templateId: number,
    statuses: StatusReorderItem[],
  ): Observable<StatusDefinitionRead[]> {
    return this.http.put<StatusDefinitionRead[]>(
      `${this.base}/${templateId}/statuses/reorder`,
      { statuses },
    );
  }

  // -----------------------------------------------------------------------
  // Task Categories
  // -----------------------------------------------------------------------

  getCategories(templateId: number): Observable<TaskCategoryRead[]> {
    return this.http.get<TaskCategoryRead[]>(
      `${this.base}/${templateId}/categories`,
    );
  }

  createCategory(
    templateId: number,
    data: TaskCategoryCreate,
  ): Observable<TaskCategoryRead> {
    return this.http.post<TaskCategoryRead>(
      `${this.base}/${templateId}/categories`,
      data,
    );
  }

  updateCategory(
    templateId: number,
    categoryId: number,
    data: TaskCategoryUpdate,
  ): Observable<TaskCategoryRead> {
    return this.http.patch<TaskCategoryRead>(
      `${this.base}/${templateId}/categories/${categoryId}`,
      data,
    );
  }

  deleteCategory(templateId: number, categoryId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/${templateId}/categories/${categoryId}`,
    );
  }

  // -----------------------------------------------------------------------
  // Task Types (nested under categories)
  // -----------------------------------------------------------------------

  getTypes(templateId: number, categoryId: number): Observable<TaskTypeRead[]> {
    return this.http.get<TaskTypeRead[]>(
      `${this.base}/${templateId}/categories/${categoryId}/types`,
    );
  }

  createType(
    templateId: number,
    categoryId: number,
    data: TaskTypeCreate,
  ): Observable<TaskTypeRead> {
    return this.http.post<TaskTypeRead>(
      `${this.base}/${templateId}/categories/${categoryId}/types`,
      data,
    );
  }

  updateType(
    templateId: number,
    categoryId: number,
    typeId: number,
    data: TaskTypeUpdate,
  ): Observable<TaskTypeRead> {
    return this.http.patch<TaskTypeRead>(
      `${this.base}/${templateId}/categories/${categoryId}/types/${typeId}`,
      data,
    );
  }

  deleteType(
    templateId: number,
    categoryId: number,
    typeId: number,
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/${templateId}/categories/${categoryId}/types/${typeId}`,
    );
  }
}