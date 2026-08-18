import { Component, effect, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button, Modal } from '../../../../shared/components';

export interface AnulacionData { motivo?: string; concepto?: string; monto: number; entidad?: string; }

@Component({
  selector: 'app-anular-movimiento-dialog',
  imports: [ReactiveFormsModule, Modal, Button],
  templateUrl: './anular-movimiento-dialog.html',
  styleUrl: './anular-movimiento-dialog.css',
})
export class AnularMovimientoDialog {
  open = input(false);
  busy = input(false);
  data = input<AnulacionData | null>(null);
  cancelled = output<void>();
  confirmed = output<string>();
  motivo = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] });

  constructor() { effect(() => { if (this.open()) this.motivo.reset(''); }); }

  confirmar() {
    if (this.motivo.invalid) {
      this.motivo.markAsTouched();
      return;
    }
    this.confirmed.emit(this.motivo.value.trim());
  }
}
