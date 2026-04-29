import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-form-card',
  imports: [
    ReactiveFormsModule, CommonModule
  ],
  templateUrl: './form-card.html',
  styleUrl: './form-card.css',
})
export class FormCard {
  @Input() form!: FormGroup;
  @Input() title: string = '';
  @Input() mostrarGuardarYAgregarOtro: boolean = false;
  @Input() esEdicion: Boolean = false;

  @Output() submit = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();
  @Output() guardarYAgregarOtro = new EventEmitter<void>();

  onGuardarYAgregarOtro() {
    this.guardarYAgregarOtro.emit();
  }

  onCancel() {
    this.cancel.emit();
  }
}
