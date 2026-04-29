import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-error-message',
  imports: [
    CommonModule, RouterLink
  ],
  templateUrl: './error-message.html',
  styleUrl: './error-message.css',
})
export class ErrorMessage {
  @Input() message: string | null = null;
  @Input() linkRedireccion: string | null = null;
  @Input() linkTexto: string | null = null;
}
