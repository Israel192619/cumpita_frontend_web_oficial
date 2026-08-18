import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

export interface SelectOption { label: string; value: unknown; disabled?: boolean; }

@Component({
  selector: 'app-select',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './select.html',
  styleUrl: './select.css',
})
export class Select {
  @Input() control: FormControl | null = null;
  @Input() label = '';
  @Input() options: SelectOption[] | any[] = [];
  @Input() placeholder = 'Seleccione...';
  @Input() value: unknown = null;
  @Input() disabled = false;
  @Input() required = false;
  @Input() error: string | null = null;
  @Input() helpText: string | null = null;
  @Input() selectId = '';
  @Output() valueChange = new EventEmitter<unknown>();
  @Output() selectionChange = new EventEmitter<unknown>();

  readonly generatedId = `select-${Math.random().toString(36).slice(2, 9)}`;
  get id(): string { return this.selectId || this.generatedId; }
  get invalid(): boolean { return !!this.error || !!(this.control?.invalid && this.control.touched); }
  get describedBy(): string | null { return this.invalid ? `${this.id}-error` : this.helpText ? `${this.id}-help` : null; }

  onChange(value: unknown): void {
    this.value = value;
    this.valueChange.emit(value);
    this.selectionChange.emit(value);
  }

  validationMessage(): string | null {
    if (this.error) return this.error;
    if (this.control?.touched && this.control.errors?.['required']) return 'Seleccione una opción.';
    return null;
  }
}
