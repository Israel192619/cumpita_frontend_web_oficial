import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ErrorMessage } from '../error-message/error-message';
import { AppCurrencyPipe } from '../../pipes/app-currency.pipe';

export interface DataTableColumn {
  key: string;
  label: string;
  type?: string;
  sortable?: boolean;
}

export interface DataTableFilterOption { label: string; value: unknown; }
export interface DataTableFilter { key: string; label: string; options: DataTableFilterOption[]; }

export interface DataTableQuery {
  search: string;
  filters: Record<string, unknown>;
  sortKey: string | null;
  sortDirection: 'asc' | 'desc';
}

@Component({
  selector: 'app-data-table',
  imports: [CommonModule, RouterLink, ErrorMessage, AppCurrencyPipe],
  templateUrl: './data-table.html',
  styleUrl: './data-table.css',
})
export class DataTable implements OnChanges {
  @Input() title = '';
  @Input() data: any[] = [];
  @Input() columns: DataTableColumn[] = [];
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() errorMessageLink: string | null = null;
  @Input() errorMessageText: string | null = null;
  @Input() createLink?: string;
  @Input() createText = '+ Crear';
  @Input() rowActions?: {
    type: string; label: string; icon?: string; class?: string; visible?: (item: any) => boolean;
  }[];

  @Input() searchable = true;
  @Input() searchPlaceholder = 'Buscar en la tabla…';
  @Input() filters: DataTableFilter[] = [];
  @Input() pagination = true;
  @Input() pageSize = 10;
  @Input() pageSizeOptions: number[] = [10, 25, 50, 100];
  @Input() emptyMessage = 'No hay datos para mostrar.';
  @Input() noResultsMessage = 'No se encontraron resultados.';

  /** Al activarlo, el componente emite cambios pero no procesa ni pagina data localmente. */
  @Input() backendPagination = false;
  @Input() totalItems?: number;
  @Input() currentPage = 1;

  @Output() refresh = new EventEmitter<void>();
  @Output() action = new EventEmitter<{ type: string; item: any }>();
  @Output() paginationChange = new EventEmitter<{ page: number; pageSize: number }>();
  @Output() queryChange = new EventEmitter<DataTableQuery>();

  searchTerm = '';
  filterValues: Record<string, unknown> = {};
  sortKey: string | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';
  internalPage = 1;
  internalPageSize = 10;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pageSize']) this.internalPageSize = this.validPageSize(this.pageSize);
    if (changes['currentPage']) this.internalPage = Math.max(1, Number(this.currentPage) || 1);
    if (changes['data'] && !changes['data'].firstChange && !this.backendPagination) this.ensureValidPage();
  }

  getValue(item: any, path: string): any {
    return path.split('.').reduce((acc, key) => acc?.[key], item);
  }

  availableActions(item: any) {
    return this.rowActions?.filter(action => !action.visible || action.visible(item)) ?? [];
  }

  isSortable(column: DataTableColumn): boolean { return column.sortable !== false && column.type !== 'image'; }

  toggleSort(column: DataTableColumn): void {
    if (!this.isSortable(column)) return;
    if (this.sortKey === column.key) this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    else { this.sortKey = column.key; this.sortDirection = 'asc'; }
    this.internalPage = 1;
    this.emitQuery();
  }

  onSearch(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value;
    this.internalPage = 1;
    this.emitQuery();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.internalPage = 1;
    this.emitQuery();
  }

  clearQuery(): void {
    this.searchTerm = '';
    this.filterValues = {};
    this.internalPage = 1;
    this.emitQuery();
  }

  onFilterChange(filter: DataTableFilter, event: Event): void {
    const rawValue = (event.target as HTMLSelectElement).value;
    const option = filter.options.find(item => String(item.value) === rawValue);
    if (rawValue === '') delete this.filterValues[filter.key];
    else this.filterValues[filter.key] = option?.value ?? rawValue;
    this.internalPage = 1;
    this.emitQuery();
  }

  onPageSizeChange(event: Event): void {
    this.internalPageSize = this.validPageSize(Number((event.target as HTMLSelectElement).value));
    this.internalPage = 1;
    this.emitPagination();
  }

  goToPage(page: number): void {
    this.internalPage = Math.min(Math.max(1, page), this.totalPages);
    this.emitPagination();
  }

  get visibleData(): any[] {
    if (this.backendPagination) return this.data ?? [];
    const processed = this.localProcessedData;
    if (!this.pagination) return processed;
    const start = (this.internalPage - 1) * this.internalPageSize;
    return processed.slice(start, start + this.internalPageSize);
  }

  get filteredCount(): number { return this.backendPagination ? (this.totalItems ?? this.data.length) : this.localProcessedData.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.filteredCount / this.internalPageSize)); }
  get rangeStart(): number { return this.filteredCount ? (this.internalPage - 1) * this.internalPageSize + 1 : 0; }
  get rangeEnd(): number { return Math.min(this.internalPage * this.internalPageSize, this.filteredCount); }
  get hasActiveQuery(): boolean { return Boolean(this.searchTerm.trim()) || Object.keys(this.filterValues).length > 0; }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const start = Math.max(1, Math.min(this.internalPage - 2, total - 4));
    return Array.from({ length: Math.min(5, total) }, (_, index) => start + index);
  }

  displayBoolean(value: unknown): string {
    if (value === true || value === 1 || value === '1') return 'Sí';
    if (value === false || value === 0 || value === '0') return 'No';
    return String(value ?? '—');
  }

  private get localProcessedData(): any[] {
    let rows = [...(this.data ?? [])];
    const search = this.normalize(this.searchTerm);
    if (search) rows = rows.filter(item => this.columns.some(column => this.normalize(this.getValue(item, column.key)).includes(search)));
    for (const [key, value] of Object.entries(this.filterValues)) {
      rows = rows.filter(item => String(this.getValue(item, key)) === String(value));
    }
    if (this.sortKey) {
      const key = this.sortKey;
      const direction = this.sortDirection === 'asc' ? 1 : -1;
      rows.sort((a, b) => this.compare(this.getValue(a, key), this.getValue(b, key)) * direction);
    }
    return rows;
  }

  private compare(a: unknown, b: unknown): number {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    const dateA = typeof a === 'string' && /^\d{4}-\d{2}-\d{2}/.test(a) ? Date.parse(a) : NaN;
    const dateB = typeof b === 'string' && /^\d{4}-\d{2}-\d{2}/.test(b) ? Date.parse(b) : NaN;
    if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) return dateA - dateB;
    return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
  }

  private normalize(value: unknown): string {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  }

  private validPageSize(size: number): number { return this.pageSizeOptions.includes(size) ? size : (this.pageSizeOptions[0] ?? 10); }
  private ensureValidPage(): void { this.internalPage = Math.min(this.internalPage, this.totalPages); }
  private emitPagination(): void { this.paginationChange.emit({ page: this.internalPage, pageSize: this.internalPageSize }); }
  private emitQuery(): void {
    this.queryChange.emit({ search: this.searchTerm, filters: { ...this.filterValues }, sortKey: this.sortKey, sortDirection: this.sortDirection });
    if (this.backendPagination) this.emitPagination();
  }
}
