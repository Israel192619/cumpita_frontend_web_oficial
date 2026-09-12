import { Component, OnInit, computed, signal } from '@angular/core';
import { AppCurrencyPipe } from '@app/shared/pipes/app-currency.pipe';
import { Icon } from '@app/shared/components/icon/icon';
import { Button } from '@app/shared/components/button/button';
import { InputForm } from '@app/shared/components/input-form/input-form';
import { Select, SelectOption } from '@app/shared/components/select/select';
import { DashboardData, DashboardService } from '../../services/dashboard-service';
import { CategoriaService } from '../../../categorias/services/categoria-service';
import { Categoria } from '../../../../core/models/categoria';

type Periodo = 'hoy' | 'ayer' | 'ultimos_7' | 'mes' | 'personalizado';

@Component({
  selector: 'app-dashboard',
  imports: [AppCurrencyPipe, Icon, Button, InputForm, Select],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  readonly periodOptions: SelectOption[] = [
    { label: 'Hoy', value: 'hoy' }, { label: 'Ayer', value: 'ayer' },
    { label: 'Últimos 7 días', value: 'ultimos_7' }, { label: 'Este mes', value: 'mes' },
    { label: 'Personalizado', value: 'personalizado' },
  ];
  readonly periodo = signal<Periodo>('hoy');
  readonly desde = signal(this.formatearFecha(new Date()));
  readonly hasta = signal(this.formatearFecha(new Date()));
  readonly datos = signal<DashboardData | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly categorias = signal<Categoria[]>([]);
  readonly categoriaId = signal<number | null>(null);
  readonly subcategoriaId = signal<number | null>(null);
  readonly categoryOptions = computed<SelectOption[]>(() => this.categorias().map(categoria => ({ label: categoria.nombre, value: categoria.id })));
  readonly subcategoryOptions = computed<SelectOption[]>(() =>
    (this.categorias().find(categoria => categoria.id === this.categoriaId())?.children ?? [])
      .map(subcategoria => ({ label: subcategoria.nombre, value: subcategoria.id }))
  );
  readonly periodoValido = computed(() => !!this.desde() && !!this.hasta() && this.desde() <= this.hasta());

  constructor(private dashboardService: DashboardService, private categoriaService: CategoriaService) {}
  ngOnInit(): void {
    this.categoriaService.listarCategorias().subscribe({ next: categorias => this.categorias.set(categorias) });
    this.cargar();
  }

  cambiarCategoria(value: unknown): void {
    this.categoriaId.set(value == null ? null : Number(value));
    this.subcategoriaId.set(null);
    this.cargar();
  }

  cambiarSubcategoria(value: unknown): void {
    this.subcategoriaId.set(value == null ? null : Number(value));
    this.cargar();
  }

  cambiarPeriodo(value: unknown): void {
    const periodo = value as Periodo;
    this.periodo.set(periodo);
    if (periodo === 'personalizado') return;
    const hoy = this.inicioDia(new Date());
    let desde = new Date(hoy);
    let hasta = new Date(hoy);
    if (periodo === 'ayer') { desde.setDate(desde.getDate() - 1); hasta = new Date(desde); }
    else if (periodo === 'ultimos_7') desde.setDate(desde.getDate() - 6);
    else if (periodo === 'mes') desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    this.desde.set(this.formatearFecha(desde));
    this.hasta.set(this.formatearFecha(hasta));
    this.cargar();
  }

  actualizarDesde(value: string | number | null): void { this.desde.set(String(value ?? '')); }
  actualizarHasta(value: string | number | null): void { this.hasta.set(String(value ?? '')); }

  cargar(): void {
    if (!this.periodoValido()) { this.error.set('La fecha inicial no puede ser posterior a la fecha final.'); return; }
    this.cargando.set(true);
    this.error.set(null);
    this.dashboardService.obtener(this.desde(), this.hasta(), this.categoriaId(), this.subcategoriaId()).subscribe({
      next: datos => { this.datos.set(datos); this.cargando.set(false); },
      error: error => { this.error.set(error?.error?.message || 'No fue posible cargar el Dashboard.'); this.cargando.set(false); },
    });
  }

  unidades(cantidad: number): string { return cantidad === 1 ? '1 ud.' : `${cantidad} uds.`; }
  private inicioDia(fecha: Date): Date { return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()); }
  private formatearFecha(fecha: Date): string {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  }
}
