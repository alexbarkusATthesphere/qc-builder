import { Component, input } from '@angular/core';

import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge';

export interface ActivityItem {
  id: number;
  title: string;
  statusName: string;
  statusColor: string;
  categoryName: string;
  priority: string;
  timestamp: string;
}

@Component({
  selector: 'app-activity-feed',
  standalone: true,
  imports: [StatusBadgeComponent],
  templateUrl: './activity-feed.html',
  styleUrl: './activity-feed.css',
})
export class ActivityFeedComponent {
  items = input.required<ActivityItem[]>();

  formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  getPriorityClass(p: string): string {
    return `af__priority--${p.toLowerCase()}`;
  }

  formatPriority(p: string): string {
    return p.charAt(0) + p.slice(1).toLowerCase();
  }
}