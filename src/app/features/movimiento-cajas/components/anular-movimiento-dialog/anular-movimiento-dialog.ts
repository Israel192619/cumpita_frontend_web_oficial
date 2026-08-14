import { Component, Inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-anular-movimiento-dialog',
  imports: [MatDialogModule, ReactiveFormsModule],
  templateUrl: './anular-movimiento-dialog.html',
  styleUrl: './anular-movimiento-dialog.css',
})
export class AnularMovimientoDialog {
  motivo = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] });

  constructor(
    public dialogRef: MatDialogRef<AnularMovimientoDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { motivo: string; monto: number }
  ) {}

  confirmar() {
    if (this.motivo.invalid) {
      this.motivo.markAsTouched();
      return;
    }
    this.dialogRef.close(this.motivo.value.trim());
  }
}
