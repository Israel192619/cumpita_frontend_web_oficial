import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppCurrencyPipe } from '@app/shared/pipes/app-currency.pipe';

@Component({
  selector: 'app-pos-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule, AppCurrencyPipe],
  templateUrl: './pos-toolbar.html',
  styleUrl: './pos-toolbar.css',
})
export class PosToolbarComponent implements OnInit, OnDestroy {
  isLoading = input(false);
  pendingOrdersCount = input(0);
  preordersCount = input(0);
  cajaAbierta = input(false);
  cajaMontoEsperado = input(0);
  cajaPagosEfectivo = input(0);
  mode = input<'pos' | 'preorden'>('pos');
  searchValue = input('');

  searchChanged = output<string>();
  backRequested = output<void>();
  pendingOrdersRequested = output<void>();
  preordersRequested = output<void>();
  cajaActionRequested = output<'abrir' | 'cerrar'>();

  currentDate = signal(new Date());
  isFullscreen = signal(false);
  private clockId?: ReturnType<typeof setInterval>;

  constructor(@Inject(DOCUMENT) private readonly document: Document) {}

  ngOnInit(): void {
    this.syncFullscreenState();
    this.document.addEventListener('fullscreenchange', this.syncFullscreenState);
    this.clockId = setInterval(() => this.currentDate.set(new Date()), 60_000);
  }

  ngOnDestroy(): void {
    this.document.removeEventListener('fullscreenchange', this.syncFullscreenState);
    if (this.clockId) clearInterval(this.clockId);
  }

  onSearchInput(event: Event): void {
    this.searchChanged.emit((event.target as HTMLInputElement).value);
  }

  onCajaAction(): void {
    this.cajaActionRequested.emit(this.cajaAbierta() ? 'cerrar' : 'abrir');
  }

  async toggleFullscreen(): Promise<void> {
    try {
      if (this.document.fullscreenElement) {
        await this.document.exitFullscreen();
      } else if (this.document.documentElement.requestFullscreen) {
        await this.document.documentElement.requestFullscreen();
      }
    } catch {
      // El navegador puede rechazar pantalla completa por permisos o política del dispositivo.
    }
  }

  private readonly syncFullscreenState = (): void => {
    this.isFullscreen.set(!!this.document.fullscreenElement);
  };
}
