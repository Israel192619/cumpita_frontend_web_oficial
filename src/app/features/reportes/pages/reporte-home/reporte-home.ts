import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ReporteService } from '../../services/reporte-service';
import { CategoriaService } from '../../../categorias/services/categoria-service';
import { ProductoService } from '../../../productos/services/producto-service';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { DateRangePicker, DateRangeValue } from '../../../../shared/components/date-range-picker/date-range-picker';
import { Button } from '../../../../shared/components/button/button';
import { DataTable, DataTableColumn } from '../../../../shared/components/data-table/data-table';
import { AppCurrencyPipe } from '../../../../shared/pipes/app-currency.pipe';

type TipoReporte = 'ventas' | 'productos' | 'caja';
type Periodo = 'hoy' | 'ayer' | 'ultimos_7' | 'mes' | 'personalizado';

@Component({ selector: 'app-reporte-home', imports: [RouterLink, RouterLinkActive, Select, DateRangePicker, Button, DataTable, AppCurrencyPipe], templateUrl: './reporte-home.html', styleUrl: './reporte-home.css' })
export class ReporteHome implements OnInit {
  readonly tipo: TipoReporte;
  readonly periodo = signal<Periodo>('hoy');
  readonly rango = signal<DateRangeValue>({ from: this.fecha(new Date()), to: this.fecha(new Date()), includeTime: false });
  readonly cargando = signal(false); readonly error = signal<string | null>(null); readonly respuesta = signal<any>(null);
  readonly metodo = signal<string | null>(null); readonly categoriaId = signal<number | null>(null); readonly productoId = signal<number | null>(null);
  readonly cajaId = signal<number | null>(null); readonly usuarioId = signal<number | null>(null);
  readonly categorias = signal<SelectOption[]>([]); readonly productos = signal<SelectOption[]>([]);
  readonly periodos: SelectOption[] = [{ label: 'Hoy', value: 'hoy' }, { label: 'Ayer', value: 'ayer' }, { label: 'Últimos 7 días', value: 'ultimos_7' }, { label: 'Este mes', value: 'mes' }, { label: 'Personalizado', value: 'personalizado' }];

  constructor(route: ActivatedRoute, private reportes: ReporteService, private categoriasService: CategoriaService, private productosService: ProductoService) {
    this.tipo = route.snapshot.data['tipo'] as TipoReporte;
  }
  ngOnInit(): void {
    if (this.tipo === 'productos') forkJoin([this.categoriasService.listarCategorias(), this.productosService.listarProductos()]).subscribe(([categorias, productos]) => {
      this.categorias.set(categorias.map(item => ({ label: item.nombre, value: item.id })));
      this.productos.set(productos.map(item => ({ label: item.nombre, value: item.id })));
    });
    this.cargar();
  }
  get titulo(): string { return `Reporte de ${this.tipo === 'caja' ? 'Caja' : this.tipo === 'ventas' ? 'Ventas' : 'Productos'}`; }
  get columnas(): DataTableColumn[] {
    if (this.tipo === 'ventas') return [{ key: 'fecha', label: 'Fecha/hora', type: 'date' }, { key: 'numero_orden', label: 'Nº orden' }, { key: 'cliente', label: 'Cliente' }, { key: 'mesa', label: 'Mesa' }, { key: 'usuario', label: 'Cajero' }, { key: 'total', label: 'Total', type: 'currency' }, { key: 'metodo_pago_label', label: 'Método' }, { key: 'estado', label: 'Estado', type: 'status' }];
    if (this.tipo === 'productos') return [{ key: 'nombre', label: 'Producto' }, { key: 'categoria', label: 'Categoría' }, { key: 'cantidad', label: 'Cantidad vendida' }, { key: 'total', label: 'Total generado', type: 'currency' }];
    return [{ key: 'fecha', label: 'Fecha', type: 'date' }, { key: 'caja', label: 'Caja' }, { key: 'usuario', label: 'Usuario' }, { key: 'efectivo_esperado', label: 'Efectivo esperado', type: 'currency' }, { key: 'efectivo_contado', label: 'Efectivo contado', type: 'currency' }, { key: 'diferencia', label: 'Diferencia', type: 'currency' }, { key: 'estado', label: 'Estado', type: 'status' }];
  }
  get filas(): any[] { return (this.respuesta()?.filas ?? []).map((fila: any) => ({ ...fila, usuario: fila.usuario || 'No registrado', metodo_pago_label: fila.tipo_pago === 'devolucion' ? `${fila.metodo_pago?.toUpperCase()} · Devolución` : fila.metodo_pago?.toUpperCase() })); }
  get opcionesMetodos(): SelectOption[] { return (this.respuesta()?.metodos_pago ?? []).map((item: string) => ({ label: item === 'qr' ? 'QR / Yape' : this.capitalizar(item), value: item })); }
  get opcionesCajas(): SelectOption[] { return (this.respuesta()?.cajas ?? []).map((item: any) => ({ label: `Caja #${item.id} · ${item.user?.name || 'Sin usuario'}`, value: item.id })); }
  get opcionesUsuarios(): SelectOption[] { const seen = new Set<number>(); return (this.respuesta()?.cajas ?? []).filter((item: any) => item.user && !seen.has(item.user.id) && seen.add(item.user.id)).map((item: any) => ({ label: item.user.name, value: item.user.id })); }
  cambiarPeriodo(value: unknown): void {
    const periodo = value as Periodo; this.periodo.set(periodo); if (periodo === 'personalizado') return;
    const hoy = new Date(); let desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()); let hasta = new Date(desde);
    if (periodo === 'ayer') { desde.setDate(desde.getDate() - 1); hasta = new Date(desde); } else if (periodo === 'ultimos_7') desde.setDate(desde.getDate() - 6); else if (periodo === 'mes') desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    this.rango.set({ from: this.fecha(desde), to: this.fecha(hasta), includeTime: false }); this.cargar();
  }
  cambiarRango(value: DateRangeValue): void { this.rango.set(value); }
  cargar(): void {
    const rango = this.rango(); if (!rango.from || !rango.to || rango.from > rango.to) { this.error.set('Selecciona un rango de fechas válido.'); return; }
    const filtros: Record<string, string | number | null> = { desde: rango.from, hasta: rango.to };
    if (this.tipo === 'ventas') filtros['metodo_pago'] = this.metodo();
    if (this.tipo === 'productos') { filtros['categoria_id'] = this.categoriaId(); filtros['producto_id'] = this.productoId(); }
    if (this.tipo === 'caja') { filtros['caja_id'] = this.cajaId(); filtros['usuario_id'] = this.usuarioId(); }
    this.cargando.set(true); this.error.set(null);
    this.reportes.obtener(this.tipo, filtros).subscribe({ next: data => { this.respuesta.set(data); this.cargando.set(false); }, error: error => { this.error.set(error?.error?.message || 'No se pudo cargar el reporte.'); this.cargando.set(false); } });
  }
  imprimir(): void { window.print(); }
  generado(): string { return new Intl.DateTimeFormat('es-BO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date()); }
  etiquetaPeriodo(): string { return `${this.rango().from ?? '—'} — ${this.rango().to ?? '—'}`; }
  private fecha(value: Date): string { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
  private capitalizar(value: string): string { return value ? value[0].toUpperCase() + value.slice(1) : value; }
}
