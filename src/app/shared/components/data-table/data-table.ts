import {
  Component,
  computed,
  input,
  output,
  signal,
  TemplateRef,
  contentChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Column configuration for the data table.
 */
export interface DataTableColumn {
  /** Property key on the row object */
  field: string;

  /** Column header label */
  header: string;

  /** Allow sorting on this column (default: true) */
  sortable?: boolean;

  /** Tailwind width class or CSS width (e.g. 'w-48', '200px') */
  width?: string;

  /** Optional cell template reference name — match with ng-template #name */
  templateRef?: string;
}

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
  field: string;
  direction: SortDirection;
}

/**
 * Reusable data table with sorting and text search.
 *
 * Usage:
 *   <app-data-table
 *     [columns]="columns"
 *     [data]="projects"
 *     [searchable]="true"
 *     [searchPlaceholder]="'Search projects...'"
 *     (rowClicked)="onProjectClick($event)"
 *   >
 *     <ng-template #status let-row>
 *       <app-status-badge [label]="row.status" [color]="row.color" />
 *     </ng-template>
 *   </app-data-table>
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './data-table.html',
  styleUrl: './data-table.css',
})
export class DataTableComponent<T extends Record<string, any> = Record<string, any>> {
  /** Column definitions */
  columns = input.required<DataTableColumn[]>();

  /** Row data */
  data = input.required<T[]>();

  /** Show the search input */
  searchable = input(false);

  /** Placeholder for the search input */
  searchPlaceholder = input('Search...');

  /** Label shown when no rows match */
  emptyMessage = input('No results found.');

  /** Emitted when a row is clicked */
  rowClicked = output<T>();

  /** Internal state */
  searchQuery = signal('');
  sort = signal<SortState>({ field: '', direction: null });

  /** Custom cell template provided via content projection */
  cellTemplates = signal<Record<string, TemplateRef<any>>>({});

  /** Filtered + sorted data */
  displayData = computed(() => {
    let rows = [...this.data()];
    const query = this.searchQuery().toLowerCase().trim();

    // Text filter
    if (query) {
      const fields = this.columns().map((c) => c.field);
      rows = rows.filter((row) =>
        fields.some((f) => {
          const val = row[f];
          return val != null && String(val).toLowerCase().includes(query);
        }),
      );
    }

    // Sort
    const { field, direction } = this.sort();
    if (field && direction) {
      rows.sort((a, b) => {
        const aVal = a[field] ?? '';
        const bVal = b[field] ?? '';
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return direction === 'asc' ? cmp : -cmp;
      });
    }

    return rows;
  });

  /** Count shown vs total */
  countLabel = computed(() => {
    const shown = this.displayData().length;
    const total = this.data().length;
    if (shown === total) return `${total} items`;
    return `${shown} of ${total} items`;
  });

  toggleSort(col: DataTableColumn): void {
    if (col.sortable === false) return;

    const current = this.sort();
    if (current.field === col.field) {
      // Cycle: asc → desc → none
      const next: SortDirection =
        current.direction === 'asc' ? 'desc' : current.direction === 'desc' ? null : 'asc';
      this.sort.set({ field: col.field, direction: next });
    } else {
      this.sort.set({ field: col.field, direction: 'asc' });
    }
  }

  getSortIcon(col: DataTableColumn): string {
    const { field, direction } = this.sort();
    if (field !== col.field || !direction) return '↕';
    return direction === 'asc' ? '↑' : '↓';
  }

  onRowClick(row: T): void {
    this.rowClicked.emit(row);
  }

  getCellValue(row: T, field: string): any {
    return row[field];
  }
}