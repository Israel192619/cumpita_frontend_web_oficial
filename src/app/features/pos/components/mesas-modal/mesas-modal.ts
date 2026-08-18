import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Mesa } from '@app/features/pos/services/pos-service';
import { Modal } from '@app/shared/components/modal/modal';

@Component({
  selector: 'app-mesas-modal',
  standalone: true,
  imports: [CommonModule, Modal],
  templateUrl: './mesas-modal.html',
  styleUrl: './mesas-modal.css',
})
export class MesasModalComponent {
  isOpen = input<boolean>(false);
  mesas = input<Mesa[]>([]);

  mesaSelected = output<Mesa>();
  closed = output<void>();

  selectMesa(mesa: Mesa): void {
    this.mesaSelected.emit(mesa);
    this.closed.emit();
  }

  close(): void {
    this.closed.emit();
  }
}
