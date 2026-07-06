import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-input-form',
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule
  ],
  templateUrl: './input-form.html',
  styleUrl: './input-form.css',
})
export class InputForm {

  constructor(private cd: ChangeDetectorRef) {

  }

  @Input() control!: FormControl;
  @Input() label!: string;
  @Input() type: string = 'text';
  @Input() placeholder: string = '';
  @Input() initialPreview: string | null = null;

  ngOnChanges(): void {
    if (this.initialPreview && !this.preview) {
      this.preview = this.initialPreview;
      //this.cd.detectChanges();
    }
  }

  preview: string | null = null;
  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (this.preview) {
      URL.revokeObjectURL(this.preview);
      this.preview = null;
    }

    if (!file) {
      this.control.setValue(null);
      return;
    }
    this.control.setValue(file);
    this.control.markAsTouched();

    this.preview = URL.createObjectURL(file);
  }

  clearImage(fileInput: HTMLInputElement) {
    this.control.setValue(null);
    this.control.markAsTouched();
    if (this.preview) {
      URL.revokeObjectURL(this.preview);
      this.preview = null;
    }
    fileInput.value = '';
  }
}
