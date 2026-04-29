import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-select',
  imports: [
    FormsModule, CommonModule, ReactiveFormsModule
  ],
  templateUrl: './select.html',
  styleUrl: './select.css',
})
export class Select {
  @Input() control!: FormControl;
  @Input() label!: string;
  @Input() options: any[] = [];
}
