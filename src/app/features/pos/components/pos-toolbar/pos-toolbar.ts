import { RouterLink } from '@angular/router';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, computed, inject, Inject, OnDestroy, OnInit, input, output, signal } from '@angular/core';
import { AuthService } from '@app/core/services/auth-service';
import { FormsModule } from '@angular/forms';
import { AppCurrencyPipe } from '@app/shared/pipes/app-currency.pipe';
import { Icon } from '@app/shared/components/icon/icon';

@Component({
  selector: 'app-pos-toolbar',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, AppCurrencyPipe, Icon],
  templateUrl: './pos-toolbar.html',
  styleUrl: './pos-toolbar.css',
})
export class PosToolbarComponent implements OnInit, OnDestroy {
  readonly usuario = inject(AuthService).usuarioActual;
  isLoading = input(false);
  backLabel = input('Volver');
  theme = input<'light' | 'dark'>('light');
  pendingOrdersCount = input(0);
  preordersCount = input(0);
  cajaAbierta = input(false);
  cajaCompartida = input(false);
  cajaPuedeCerrar = input(false);
  cajaResponsable = input('');
  puedeRegistrarGastos = input(false);
  cajaMontoEsperado = input(0);
  cajaPagosEfectivo = input(0);
  mode = input<'pos' | 'preorden'>('pos');
  searchValue = input('');
  showUserMenu = input(false);

  searchChanged = output<string>();
  backRequested = output<void>();
  pendingOrdersRequested = output<void>();
  todayOrdersRequested = output<void>();
  preordersRequested = output<void>();
  gastoRequested = output<void>();
  movimientoRequested = output<void>();
  themeToggle = output<void>();
  cajaActionRequested = output<'abrir' | 'cerrar' | 'salir'>();

  currentDate = signal(new Date());
  currentDateLabel = computed(() => {
    const fecha = new Intl.DateTimeFormat('es-BO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(this.currentDate());
    return fecha.charAt(0).toUpperCase() + fecha.slice(1);
  });
  isFullscreen = signal(false);
  avatarFallido = signal(false);
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
    if (this.cajaCompartida()) {
      this.cajaActionRequested.emit('salir');
      return;
    }
    if (this.cajaAbierta() && !this.cajaPuedeCerrar()) return;
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
