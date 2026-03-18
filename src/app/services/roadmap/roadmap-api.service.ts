/**
 * Roadmap API service.
 *
 * Location: app/core/api/roadmap-api/roadmap-api.service.ts
 */

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { RoadmapSummaryParams, RoadmapSummaryRead } from './roadmap-api.model';

@Injectable({ providedIn: 'root' })
export class RoadmapService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.api.v1Url}/roadmap`;

  /**
   * Fetch the executive roadmap summary for a project, optionally
   * scoped to a single environment (DEV / TEST / PROD).
   */
  getRoadmapSummary(
    projectId: number,
    filters?: RoadmapSummaryParams,
  ): Observable<RoadmapSummaryRead> {
    let params = new HttpParams();
    if (filters?.environment) {
      params = params.set('environment', filters.environment);
    }
    return this.http.get<RoadmapSummaryRead>(
      `${this.base}/projects/${projectId}/summary`,
      { params },
    );
  }
}