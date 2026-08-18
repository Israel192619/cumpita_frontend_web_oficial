import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

export type InputFormType = 'text' | 'number' | 'email' | 'password' | 'date' | 'search' | 'tel' | 'textarea' | 'file';

@Component({
  selector: 'app-input-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './input-form.html',
  styleUrl: './input-form.css',
})
export class InputForm implements OnChanges, OnDestroy {
  @Input() control: FormControl | null = null;
  @Input() label = '';
  @Input() type: InputFormType = 'text';
  @Input() placeholder = '';
  @Input() initialPreview: string | null = null;
  @Input() value: string | number | null = null;
  @Input() required = false;
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() error: string | null = null;
  @Input() helpText: string | null = null;
  @Input() inputId = '';
  @Input() autocomplete = 'off';
  @Input() min: number | string | null = null;
  @Input() max: number | string | null = null;
  @Input() step: number | string | null = null;
  @Input() maxlength: number | null = null;
  @Input() inputmode: string | null = null;
  @Output() valueChange = new EventEmitter<string | number | null>();
  @Output() inputBlur = new EventEmitter<FocusEvent>();

  readonly generatedId = `input-${Math.random().toString(36).slice(2, 9)}`;
  preview: string | null = null;

  get id(): string { return this.inputId || this.generatedId; }
  get invalid(): boolean { return !!this.error || !!(this.control?.invalid && this.control.touched); }
  get describedBy(): string | null { return this.invalid ? `${this.id}-error` : this.helpText ? `${this.id}-help` : null; }

  ngOnChanges(): void {
    if (this.initialPreview && !this.preview) this.preview = this.initialPreview;
  }

  ngOnDestroy(): void { this.revokeLocalPreview(); }

  onNativeInput(event: Event): void {
    const element = event.target as HTMLInputElement;
    this.value = this.type === 'number' && element.value !== '' ? Number(element.value) : element.value;
    this.valueChange.emit(this.value);
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.revokeLocalPreview();
    this.control?.setValue(file);
    this.control?.markAsTouched();
    this.valueChange.emit(file as unknown as string | null);
    if (file) this.preview = URL.createObjectURL(file);
  }

  clearImage(fileInput: HTMLInputElement): void {
    this.control?.setValue(null);
    this.control?.markAsTouched();
    this.valueChange.emit(null);
    this.revokeLocalPreview();
    fileInput.value = '';
  }

  validationMessage(): string | null {
    if (this.error) return this.error;
    const errors = this.control?.errors;
    if (!errors || !this.control?.touched) return null;
    if (errors['required']) return 'Este campo es obligatorio.';
    if (errors['email']) return 'Ingresa un correo válido.';
    if (errors['minlength']) return `Mínimo ${errors['minlength'].requiredLength} caracteres.`;
    if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres.`;
    if (errors['min']) return `El valor mínimo es ${errors['min'].min}.`;
    if (errors['max']) return `El valor máximo es ${errors['max'].max}.`;
    if (errors['pattern']) return 'El formato ingresado no es válido.';
    return 'Revisa este campo.';
  }

  private revokeLocalPreview(): void {
    if (this.preview?.startsWith('blob:')) URL.revokeObjectURL(this.preview);
    this.preview = null;
  }
}
