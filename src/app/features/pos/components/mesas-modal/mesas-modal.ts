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

  posicionPredeterminada(mesa: Mesa): { x: number; y: number } {
    const numero = Number(mesa.numero);
    if (numero >= 1 && numero <= 5) return { x: 58, y: 9 + (numero - 1) * 13 };
    if (numero >= 6 && numero <= 11) return { x: 78, y: 9 + (numero - 6) * 13 };
    const indice = Math.max(0, this.mesas().findIndex(item => item.id === mesa.id));
    return { x: 5 + (indice % 6) * 14, y: 82 };
  }
}
