import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RouterLink } from '@angular/router';

export type ButtonColor = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark';
export type ButtonSize = 'small' | 'medium' | 'large';
export type ButtonType = 'button' | 'submit' | 'reset';

@Component({
  selector: 'app-button',
  imports: [CommonModule, RouterLink],
  templateUrl: './button.html',
  styleUrl: './button.css',
})
export class Button {
  @Input() text: string = 'Button';
  @Input() color: ButtonColor = 'primary';
  @Input() size: ButtonSize = 'medium';
  @Input() loading: boolean = false;
  @Input() disabled: boolean = false;
  @Input() link: string | null = null;
  @Input() type: ButtonType = 'button';
  @Output() buttonClick  = new EventEmitter<void>();

  onButtonClick(): void {
    if (!this.loading && !this.disabled) {
      this.buttonClick .emit();
    }
  }

  get isDisabled(): boolean {
    return this.disabled || this.loading;
  }

  get buttonClasses(): string {
    return `btn btn-${this.color} btn-${this.size}`;
  }
}
