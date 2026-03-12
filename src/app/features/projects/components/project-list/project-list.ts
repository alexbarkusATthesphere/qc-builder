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
      active: '#05C3DD',   // Sphere Blue
      on_hold: '#fbbf24',
      complete: '#34d399',
      archived: '#64748b',
    };
    return colors[status.toLowerCase()] ?? '#64748b';
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