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
  @Input() enableCamera = false;
  @Input() optimizeImage = false;
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
  @Input() digitsOnly = false;
  @Output() valueChange = new EventEmitter<string | number | null>();
  @Output() imageCleared = new EventEmitter<void>();
  @Output() imageSelected = new EventEmitter<void>();
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
    if (this.digitsOnly) {
      const digits = element.value.replace(/[^0-9]/g, '');
      element.value = this.maxlength === null ? digits : digits.slice(0, this.maxlength);
      if (this.control && this.control.value !== element.value) this.control.setValue(element.value);
    }
    this.value = this.type === 'number' && element.value !== '' ? Number(element.value) : element.value;
    this.valueChange.emit(this.value);
  }

  async onFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const selectedFile = input.files?.[0] ?? null;
    const file = selectedFile && this.optimizeImage
      ? await this.prepareImage(selectedFile)
      : selectedFile;
    this.revokeLocalPreview();
    this.control?.setValue(file);
    this.control?.markAsTouched();
    this.valueChange.emit(file as unknown as string | null);
    if (file) {
      this.preview = URL.createObjectURL(file);
      this.imageSelected.emit();
    }
  }

  clearImage(...fileInputs: HTMLInputElement[]): void {
    this.control?.setValue(null);
    this.control?.markAsTouched();
    this.valueChange.emit(null);
    this.revokeLocalPreview();
    fileInputs.forEach(input => input.value = '');
    this.imageCleared.emit();
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
    if (errors['pattern']) return this.digitsOnly ? 'Ingresa entre 4 y 6 dígitos numéricos.' : 'El formato ingresado no es válido.';
    return 'Revisa este campo.';
  }

  private revokeLocalPreview(): void {
    if (this.preview?.startsWith('blob:')) URL.revokeObjectURL(this.preview);
    this.preview = null;
  }

  private async prepareImage(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) return file;
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) { bitmap.close(); return file; }
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();

      let quality = .86;
      let blob = await this.canvasBlob(canvas, quality);
      while (blob.size > 1_800_000 && quality > .56) {
        quality -= .1;
        blob = await this.canvasBlob(canvas, quality);
      }
      const baseName = file.name.replace(/\.[^.]+$/, '') || `foto-${Date.now()}`;
      return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
    } catch {
      return file;
    }
  }

  private canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('No se pudo preparar la imagen.')),
      'image/jpeg', quality));
  }
}
