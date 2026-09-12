import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { ModificadorEstructurado, Producto } from '../../core/models/producto';
import { ReverbService } from '../../core/services/reverb-service';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

interface ItemSolicitud { producto: Producto; cantidad: number; opcionIds: number[]; nota: string; }

@Component({
  selector: 'app-solicitud-preorden-publica',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './solicitud-preorden-publica.html',
  styleUrls: ['./solicitud-preorden-publica.css', './solicitud-preorden-publica-mobile.css']
})
export class SolicitudPreordenPublica implements OnInit, OnDestroy {
  productos = signal<Producto[]>([]);
  carrito = signal<ItemSolicitud[]>([]);
  productoConfigurando = signal<Producto | null>(null);
  opcionesTemporales = signal<number[]>([]);
  cargando = signal(true);
  enviando = signal(false);
  error = signal('');
  codigo = signal('');
  estado = signal('');
  consultandoEstado = signal(false);
  errorSeguimiento = signal('');
  copiado = signal(false);
  codigoConsulta = '';
  resumenAbierto = signal(false);
  buscandoCliente = signal(false);
  categoriaSeleccionada = signal<number | null>(null);
  busqueda = signal('');
  nombre = '';
  telefono = '';
  tipoOrden: 'dine-in' | 'to-go' = 'to-go';
  fecha = this.fechaLocal(new Date());
  hora = '';
  horaMinima = '';
  hayHorarioHoy = true;
  observaciones = '';
  notaTemporal = '';
  readonly minimoFecha = new Date().toISOString().slice(0, 10);
  private seguimiento?: ReturnType<typeof setInterval>;
  private ultimoTelefonoConsultado = '';
  private inventarioSub?: Subscription;
  categorias = computed(() => {
    const mapa = new Map<number, string>();
    this.productos().forEach(p => mapa.set(p.categoria_id, p.categoria?.nombre || 'Otros'));
    return [...mapa.entries()].map(([id, nombre]) => ({ id, nombre }));
  });
  filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const categoria = this.categoriaSeleccionada();
    return this.productos().filter(p => {
      const coincideTexto = !q || `${p.nombre} ${p.descripcion ?? ''} ${p.categoria?.nombre ?? ''}`.toLowerCase().includes(q);
      return coincideTexto && (q ? true : categoria === null || p.categoria_id === categoria);
    });
  });
  total = computed(() => this.carrito().reduce((total, item) => total + item.cantidad * this.precioItem(item), 0));
  cantidadTotal = computed(() => this.carrito().reduce((total, item) => total + item.cantidad, 0));

  private readonly codigoStorageKey = 'ultima_solicitud_preorden';

  constructor(private http: HttpClient, private reverb: ReverbService, private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.actualizarHoraMinima();
    this.cargarCatalogo();
    this.inventarioSub = this.reverb.escucharCanal('canal-inventario', '.ReservaStockActualizada').subscribe(() => this.cargarCatalogo(false));
    const codigoUrl = this.route.snapshot.queryParamMap.get('codigo');
    const codigoGuardado = localStorage.getItem(this.codigoStorageKey);
    const codigo = codigoUrl || codigoGuardado;
    if (codigo) this.consultarCodigo(codigo, true);
  }

  private cargarCatalogo(mostrarCarga = true): void {
    if (mostrarCarga) this.cargando.set(true);
    this.http.get<{ productos: Producto[] }>(`${environment.apiUrl}/publico/catalogo-preorden`).subscribe({
      next: r => {
        this.productos.set(r.productos);
        if (this.carrito().some((_, index) => this.excesoStock(index))) {
          this.error.set('La disponibilidad cambió. Reduce los productos marcados antes de enviar.');
        }
        this.cargando.set(false);
      },
      error: () => { this.error.set('No pudimos cargar el menú. Intenta nuevamente.'); this.cargando.set(false); }
    });
  }

  ngOnDestroy(): void { if (this.seguimiento) clearInterval(this.seguimiento); this.inventarioSub?.unsubscribe(); }

  telefonoIngresado(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const telefono = input.value.replace(/\D/g, '').slice(0, 8);
    input.value = telefono;
    this.telefono = telefono;
    if (this.telefono.length !== 8) {
      this.ultimoTelefonoConsultado = '';
      return;
    }
    this.telefonoCambiado();
  }

  telefonoCambiado(): void {
    const telefono = this.telefono.replace(/\D/g, '');
    if (telefono.length !== 8 || telefono === this.ultimoTelefonoConsultado) return;
    this.ultimoTelefonoConsultado = telefono;
    this.buscandoCliente.set(true);
    this.http.get<{ cliente: { nombre: string } | null }>(`${environment.apiUrl}/publico/clientes/por-telefono`, { params: { telefono } }).subscribe({
      next: r => { if (r.cliente?.nombre) this.nombre = r.cliente.nombre; this.buscandoCliente.set(false); },
      error: () => this.buscandoCliente.set(false),
    });
  }

  agregar(producto: Producto): void {
    if (producto.modificadores?.length) {
      this.productoConfigurando.set(producto);
      this.opcionesTemporales.set(producto.modificadores.flatMap(g => (g.opciones ?? []).filter(o => o.predeterminado).map(o => o.id)));
      this.notaTemporal = '';
      return;
    }
    this.insertar(producto, [], '');
  }

  toggle(grupo: ModificadorEstructurado, id: number): void {
    const actuales = this.opcionesTemporales();
    const idsGrupo = new Set((grupo.opciones ?? []).map(o => o.id));
    if (actuales.includes(id)) this.opcionesTemporales.set(actuales.filter(x => x !== id));
    else if (grupo.tipo === 'unico') this.opcionesTemporales.set([...actuales.filter(x => !idsGrupo.has(x)), id]);
    else {
      const cantidadActual = actuales.filter(x => idsGrupo.has(x)).length;
      const limite = grupo.cantidad_requerida == null ? null : Number(grupo.cantidad_requerida);
      if (limite !== null && cantidadActual >= limite) return;
      this.opcionesTemporales.set([...actuales, id]);
    }
  }

  seleccionValida(): boolean {
    const p = this.productoConfigurando();
    if (!p) return false;
    return (p.modificadores ?? []).every(g => {
      const cantidad = (g.opciones ?? []).filter(o => this.opcionesTemporales().includes(o.id)).length;
      return g.cantidad_requerida != null ? cantidad === Number(g.cantidad_requerida) : (!g.requerido || cantidad > 0) && (g.tipo !== 'unico' || cantidad <= 1);
    });
  }

  opcionBloqueada(grupo: ModificadorEstructurado, id: number): boolean {
    if (this.opcionesTemporales().includes(id)) return false;
    const opcion = (grupo.opciones ?? []).find(item => item.id === id);
    if (opcion?.maneja_stock && opcion.stock_disponible != null
      && this.consumo({ tipo: 'opcion', id }) >= opcion.stock_disponible) return true;
    if (grupo.cantidad_requerida == null) return false;
    const idsGrupo = new Set((grupo.opciones ?? []).map(o => o.id));
    return this.opcionesTemporales().filter(x => idsGrupo.has(x)).length >= Number(grupo.cantidad_requerida);
  }

  confirmarProducto(): void {
    const p = this.productoConfigurando();
    if (!p || !this.seleccionValida()) return;
    this.insertar(p, this.opcionesTemporales(), this.notaTemporal);
    this.productoConfigurando.set(null);
  }

  insertar(producto: Producto, opcionIds: number[], nota: string): void {
    const opcionesNormalizadas = [...opcionIds].map(Number).sort((a, b) => a - b);
    const notaNormalizada = nota.trim();
    if (!this.puedeAgregar(producto, opcionesNormalizadas)) {
      this.error.set(`No hay más stock disponible de ${this.recursoLimitante(producto, opcionesNormalizadas)}.`);
      return;
    }
    this.error.set('');
    this.carrito.update(items => {
      const indice = items.findIndex(item =>
        item.producto.id === producto.id
        && Number(this.precioItem(item)) === Number(this.precioItem({ producto, cantidad: 1, opcionIds: opcionesNormalizadas, nota: notaNormalizada }))
        && item.nota.trim() === notaNormalizada
        && this.mismasOpciones(item.opcionIds, opcionesNormalizadas)
      );
      if (indice < 0) return [...items, { producto, cantidad: 1, opcionIds: opcionesNormalizadas, nota: notaNormalizada }];
      return items.map((item, i) => i === indice ? { ...item, cantidad: item.cantidad + 1 } : item);
    });
  }

  private mismasOpciones(a: number[], b: number[]): boolean {
    const izquierda = [...a].map(Number).sort((x, y) => x - y);
    return izquierda.length === b.length && izquierda.every((id, indice) => id === b[indice]);
  }
  cambiarCantidad(index: number, delta: number): void {
    if (delta > 0 && !this.puedeAumentar(index)) {
      const item = this.carrito()[index];
      this.error.set(`No hay más stock disponible de ${this.recursoLimitante(item.producto, item.opcionIds)}.`);
      return;
    }
    this.error.set('');
    this.carrito.update(items => items.map((x, i) => i === index ? { ...x, cantidad: Math.max(1, x.cantidad + delta) } : x));
  }
  quitar(index: number): void { this.carrito.update(items => items.filter((_, i) => i !== index)); }
  nombresOpciones(item: ItemSolicitud): string {
    return (item.producto.modificadores ?? []).flatMap(g => g.opciones ?? []).filter(o => item.opcionIds.includes(o.id)).map(o => o.nombre).join(' · ');
  }
  precioItem(item: ItemSolicitud): number {
    const extra = (item.producto.modificadores ?? []).flatMap(g => g.opciones ?? []).filter(o => item.opcionIds.includes(o.id)).reduce((s, o) => s + Number(o.precio_extra || 0), 0);
    return Number(item.producto.precio) + extra;
  }
  puedeAumentar(index: number): boolean {
    const item = this.carrito()[index];
    return !!item && this.capacidadAdicional(item.producto, item.opcionIds) > 0;
  }
  excesoStock(index: number): boolean {
    const item = this.carrito()[index];
    return !!item && this.recursos(item.producto, item.opcionIds)
      .some(recurso => recurso.disponible !== null && this.consumo(recurso) > recurso.disponible);
  }
  disponibilidadItem(index: number): string {
    const item = this.carrito()[index];
    if (!item) return '';
    const limitados = this.recursos(item.producto, item.opcionIds).filter(recurso => recurso.disponible !== null);
    if (!limitados.length) return '';
    const recurso = limitados.reduce((menor, actual) =>
      actual.disponible! - this.consumo(actual) < menor.disponible! - this.consumo(menor) ? actual : menor
    );
    const restante = Math.max(0, recurso.disponible! - this.consumo(recurso));
    return restante > 0 ? `${restante} ${recurso.nombre} disponibles` : `Sin más disponibilidad de ${recurso.nombre}`;
  }
  stockOpcion(opcion: { maneja_stock?: boolean; stock_disponible?: number | null }): string {
    return opcion.maneja_stock && opcion.stock_disponible != null ? `${opcion.stock_disponible} disponibles` : '';
  }

  private puedeAgregar(producto: Producto, opcionIds: number[]): boolean {
    return this.capacidadAdicional(producto, opcionIds) > 0;
  }
  private capacidadAdicional(producto: Producto, opcionIds: number[]): number {
    const capacidades = this.recursos(producto, opcionIds)
      .filter(recurso => recurso.disponible !== null)
      .map(recurso => recurso.disponible! - this.consumo(recurso));
    return capacidades.length ? Math.min(...capacidades) : Number.POSITIVE_INFINITY;
  }
  private recursoLimitante(producto: Producto, opcionIds: number[]): string {
    const limitados = this.recursos(producto, opcionIds).filter(recurso => recurso.disponible !== null);
    if (!limitados.length) return producto.nombre;
    return limitados.reduce((menor, actual) =>
      actual.disponible! - this.consumo(actual) < menor.disponible! - this.consumo(menor) ? actual : menor
    ).nombre;
  }
  private recursos(producto: Producto, opcionIds: number[]): Array<{ tipo: 'producto' | 'opcion'; id: number; nombre: string; disponible: number | null }> {
    const fresco = this.productos().find(item => item.id === producto.id);
    const recursos: Array<{ tipo: 'producto' | 'opcion'; id: number; nombre: string; disponible: number | null }> = [];
    if (producto.maneja_stock || fresco?.maneja_stock) {
      recursos.push({ tipo: 'producto', id: producto.id, nombre: producto.nombre, disponible: fresco?.stock_disponible ?? 0 });
    }
    const anteriores = (producto.modificadores ?? []).flatMap(grupo => grupo.opciones ?? []);
    const actuales = (fresco?.modificadores ?? []).flatMap(grupo => grupo.opciones ?? []);
    for (const id of opcionIds) {
      const anterior = anteriores.find(opcion => opcion.id === id);
      const actual = actuales.find(opcion => opcion.id === id);
      if (anterior?.maneja_stock || actual?.maneja_stock) {
        recursos.push({ tipo: 'opcion', id, nombre: actual?.nombre ?? anterior?.nombre ?? 'esta opción', disponible: actual?.stock_disponible ?? 0 });
      }
    }
    return recursos;
  }
  private consumo(recurso: { tipo: 'producto' | 'opcion'; id: number }): number {
    return this.carrito().reduce((total, item) => {
      const usa = recurso.tipo === 'producto' ? item.producto.id === recurso.id : item.opcionIds.includes(recurso.id);
      return total + (usa ? item.cantidad : 0);
    }, 0);
  }
  moneda(valor: number): string { return `Bs ${valor.toFixed(2).replace('.', ',')}`; }

  enviar(): void {
    if (!/^\d{8}$/.test(this.telefono)) {
      this.error.set('Ingresa un teléfono de 8 dígitos, usando solamente números.');
      return;
    }
    this.error.set('');
    if (!this.nombre.trim() || !this.telefono.trim() || !this.fecha || !this.hora || !this.carrito().length) {
      this.error.set('Completa tus datos, la fecha, la hora y agrega al menos un producto.'); return;
    }
    if (this.carrito().some((_, index) => this.excesoStock(index))) {
      this.error.set('La cantidad solicitada supera el stock disponible. Reduce los productos marcados.'); return;
    }
    const programada = new Date(`${this.fecha}T${this.hora}:00`);
    const minima = new Date(Date.now() + 20 * 60 * 1000);
    if (programada < minima) { this.error.set('Selecciona una hora con al menos 20 minutos de anticipación.'); return; }
    this.enviando.set(true);
    this.http.post<any>(`${environment.apiUrl}/publico/solicitudes-preorden`, {
      cliente_nombre: this.nombre, cliente_telefono: this.telefono, tipo_orden: this.tipoOrden,
      fecha_programada: `${this.fecha} ${this.hora}:00`, observaciones: this.observaciones || null,
      items: this.carrito().map(i => ({ producto_id: i.producto.id, cantidad: i.cantidad, modificador_opcion_ids: i.opcionIds, nota: i.nota || null }))
    }).subscribe({
      next: r => {
        this.codigo.set(r.codigo); this.codigoConsulta = r.codigo; this.estado.set(r.estado); this.enviando.set(false);
        localStorage.setItem(this.codigoStorageKey, r.codigo);
        this.router.navigate([], { relativeTo: this.route, queryParams: { codigo: r.codigo }, replaceUrl: true });
        this.iniciarSeguimiento();
      },
      error: e => {
        const errores = Object.values(e?.error?.errors ?? {}) as string[][];
        this.error.set(e?.error?.message || errores[0]?.[0] || 'No se pudo enviar la solicitud.');
        this.enviando.set(false);
      }
    });
  }

  textoEstado(): string {
    return ({ pendiente: 'Pendiente de revisión', aceptada: 'Preorden confirmada', rechazada: 'Solicitud rechazada', vencida: 'Solicitud vencida', cancelada: 'Solicitud cancelada' } as Record<string, string>)[this.estado()] ?? this.estado();
  }

  consultarCodigo(codigo = this.codigoConsulta, silencioso = false): void {
    const limpio = codigo.trim();
    if (!limpio) { if (!silencioso) this.errorSeguimiento.set('Ingresa el código de seguimiento.'); return; }
    this.consultandoEstado.set(true);
    this.http.get<any>(`${environment.apiUrl}/publico/solicitudes-preorden/${encodeURIComponent(limpio)}`).subscribe({
      next: r => {
        const solicitud = r.solicitud;
        this.codigo.set(solicitud.codigo); this.codigoConsulta = solicitud.codigo; this.estado.set(solicitud.estado);
        this.nombre = solicitud.cliente || ''; this.telefono = solicitud.telefono || '';
        localStorage.setItem(this.codigoStorageKey, solicitud.codigo);
        this.router.navigate([], { relativeTo: this.route, queryParams: { codigo: solicitud.codigo }, replaceUrl: true });
        this.consultandoEstado.set(false); this.errorSeguimiento.set(''); this.iniciarSeguimiento();
      },
      error: () => { this.consultandoEstado.set(false); localStorage.removeItem(this.codigoStorageKey); if (!silencioso) this.errorSeguimiento.set('No encontramos una solicitud con ese código.'); }
    });
  }

  nuevaSolicitud(): void {
    if (this.seguimiento) clearInterval(this.seguimiento);
    localStorage.removeItem(this.codigoStorageKey);
    this.codigo.set(''); this.codigoConsulta = ''; this.estado.set(''); this.carrito.set([]); this.error.set(''); this.errorSeguimiento.set(''); this.copiado.set(false);
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  async copiarSeguimiento(): Promise<void> {
    const codigo = this.codigo();
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
    } catch {
      const campo = document.createElement('textarea'); campo.value = codigo; document.body.appendChild(campo); campo.select(); document.execCommand('copy'); campo.remove();
    }
    this.copiado.set(true);
    setTimeout(() => this.copiado.set(false), 2000);
  }

  private iniciarSeguimiento(): void {
    if (this.seguimiento) clearInterval(this.seguimiento);
    this.seguimiento = setInterval(() => {
      const codigo = this.codigo();
      if (!codigo || this.estado() !== 'pendiente') return;
      this.http.get<any>(`${environment.apiUrl}/publico/solicitudes-preorden/${codigo}`).subscribe({
        next: r => {
          this.estado.set(r.solicitud.estado);
          if (r.solicitud.estado !== 'pendiente' && this.seguimiento) clearInterval(this.seguimiento);
        },
        error: () => undefined,
      });
    }, 10000);
  }

  private fechaLocal(fecha: Date): string {
    const y = fecha.getFullYear(); const m = String(fecha.getMonth() + 1).padStart(2, '0'); const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  actualizarHoraMinima(): void {
    const minima = new Date(Date.now() + 20 * 60 * 1000);
    if (minima.getSeconds() || minima.getMilliseconds()) minima.setMinutes(minima.getMinutes() + 1, 0, 0);
    this.hayHorarioHoy = this.fechaLocal(minima) === this.fecha;
    this.horaMinima = `${String(minima.getHours()).padStart(2, '0')}:${String(minima.getMinutes()).padStart(2, '0')}`;
    if (this.hayHorarioHoy && (!this.hora || this.hora < this.horaMinima)) this.hora = this.horaMinima;
  }
}
