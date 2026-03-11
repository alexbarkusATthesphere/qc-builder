import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge';
import { ProjectRead } from '../../../../services/project';
import { ProjectService } from '../../../../services/project';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [StatusBadgeComponent],
  templateUrl: './project-list.html',
  styleUrl: './project-list.css',
})
export class ProjectListComponent implements OnInit {
  private projectService = inject(ProjectService);
  private router = inject(Router);

  projects = signal<ProjectRead[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.projectService.getProjects().subscribe({
      next: (data) => {
        this.projects.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openProject(project: ProjectRead): void {
    this.router.navigate(['/projects', project.id]);
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      active: '#3B82F6',
      on_hold: '#F59E0B',
      complete: '#10B981',
      archived: '#6B7280',
    };
    return colors[status] ?? '#6B7280';
  }

  formatStatus(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}