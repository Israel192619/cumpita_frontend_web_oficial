import { Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { Loader } from '../loader/loader';
import { ErrorMessage } from '../error-message/error-message';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-data-table',
  imports: [
    Loader, ErrorMessage, CommonModule, RouterLink
  ],
  templateUrl: './data-table.html',
  styleUrl: './data-table.css',
})
export class DataTable {
  @Input() title: string = '';
  @Input() data: any[] = [];

  @Input() columns: {
    key: string,
    label: string,
    type?: string
  }[] = [];

  @Input() loading: boolean = false;
  @Input() error: string | null = null;
  @Input() errorMessageLink: string | null = null;
  @Input() errorMessageText: string | null = null;

  @Input() createLink?: string;

  @Output() refresh = new EventEmitter<void>();
  @Output() action = new EventEmitter<{ type: string, item: any }>();

  getValue(item: any, path: string) {
  return path.split('.').reduce((acc, key) => acc?.[key], item);
}
}
