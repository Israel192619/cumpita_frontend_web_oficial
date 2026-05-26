import { Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { Loader } from '../loader/loader';
import { ErrorMessage } from '../error-message/error-message';
import { Button } from '../button/button';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-data-table',
  imports: [
    Loader, ErrorMessage, Button, CommonModule
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
  ngOnChanges(changes: SimpleChanges): void {
    console.log('Current data:', this.data);
  }

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
