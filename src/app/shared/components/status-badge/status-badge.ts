import { Component, computed, input } from '@angular/core';

/**
 * Displays a colored status pill.
 *
 * Usage:
 *   <app-status-badge [label]="'In Progress'" [color]="'#3B82F6'" />
 *   <app-status-badge [label]="'Blocked'" [color]="'#EF4444'" [size]="'sm'" />
 *
 * When no color is provided, falls back to a neutral slate palette.
 * The text color is computed automatically for contrast (white on dark, dark on light).
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  templateUrl: './status-badge.html',
  styleUrl: './status-badge.css',
})
export class StatusBadgeComponent {
  /** Display text inside the badge */
  label = input.required<string>();

  /** Hex color from the status definition (e.g. '#3B82F6') */
  color = input<string | null>(null);

  /** Badge size variant */
  size = input<'sm' | 'md'>('md');

  /** Computed background with 15% opacity tint */
  bgColor = computed(() => {
    const hex = this.color();
    if (!hex) return '#e2e8f0';
    return this.hexToRgba(hex, 0.15);
  });

  /** Computed text color — uses the full hex color for readable tinted badges */
  textColor = computed(() => {
    const hex = this.color();
    return hex ?? '#475569';
  });

  /** Computed dot color — solid version of the status color */
  dotColor = computed(() => {
    const hex = this.color();
    return hex ?? '#94a3b8';
  });

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}