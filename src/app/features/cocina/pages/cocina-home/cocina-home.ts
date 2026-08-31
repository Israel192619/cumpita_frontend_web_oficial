import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ReverbService } from '@app/core/services/reverb-service';
import { AuthService } from '@app/core/services/auth-service';
import { User } from '@app/core/models/user';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router } from '@angular/router';
import { ActualizacionEstadoCocinaResponse, CocinaService, KdsCambioOrden, KdsDetalle, KdsEstacion, KdsOrden } from '../../services/cocina-service';
import { formatCurrency } from '@app/core/config/currency.config';
import { ThemeService } from '@app/core/services/theme-service';

interface KdsDetalleEstadoAgrupado {
  clave: string;
  etiqueta: string;
  cantidad: number;
  detalles: KdsDetalle[];
  bloqueado: boolean;
  listoParaAtender: boolean;
}

interface KdsDetalleAgrupado {
  clave: string;
  cantidad: number;
  producto: KdsDetalle['producto'];
  nota?: string | null;
  opciones: string[];
  estados: KdsDetalleEstadoAgrupado[];
  tieneListos: boolean;
  todosBloqueados: boolean;
}

@Component({
  selector: 'app-cocina-home',
  imports: [CommonModule],
  templateUrl: './cocina-home.html',
  styleUrls: ['./cocina-home.css', './cocina-states.css', './cocina-theme.css'],
})
export class CocinaHome implements OnInit, OnDestroy {
  ordenes = signal<KdsOrden[]>([]);
  preordenesProgramadas = signal<KdsOrden[]>([]);
  categoriaSeleccionada = signal<string>('todos');
  fechaSeleccionada = signal<string>(this.fechaDeHoy());
  busqueda = signal<string>('');
  isLoading = signal<boolean>(true);
  detalleActualizando = signal<number | null>(null);
  usuario = signal<User | null>(null);
  private subscriptions: Subscription[] = [];
  private sesionHeartbeat?: ReturnType<typeof setInterval>;
  private actualizacionPreordenTimer?: ReturnType<typeof setInterval>;
  private estacionSesionId: number | null = null;
  private readonly claveAlertasPreorden = 'tonito-kds-preordenes-alertadas';
  private preordenesAlertadas = new Set<string>();
  private ordenesAlertadas = new Set<number>();
  private contextoAlertas?: AudioContext;
  private alertasSonorasHabilitadas = false;
  private readonly habilitarAlertasSonoras = (): void => {
    if (this.contextoAlertas) return;
    try {
      const contexto = new AudioContext();
      void contexto.resume().then(() => {
        this.contextoAlertas = contexto;
        this.alertasSonorasHabilitadas = contexto.state === 'running';
      }).catch(() => void contexto.close());
    } catch {
      // El aviso visual funciona aunque el equipo no admita sonido.
    }
  };
  estacionId = signal<number | null>(null);
  estacionActual = signal<KdsEstacion | null>(null);
  estacionesDisponibles = signal<KdsEstacion[]>([]);
  estacionSolicitada = signal<string | null>(null);
  mobileFiltersOpen = signal(false);
  isFullscreen = signal(false);
  controlesOcultos = signal(true);
  verServidos = signal(false);
  detallesCompletadosAbiertos = signal<Record<number, boolean>>({});

  puedeCambiarEstacion = computed(() => this.estacionesDisponibles().length > 1);
  esAdministrador = computed(() => {
    const rol = this.usuario()?.role?.nombre?.trim().toLowerCase() ?? '';
    return rol === 'admin' || rol === 'administrador';
  });

  produccionParrilla = computed(() => {
    const productos = new Map<string, { etiqueta: string; cantidad: number; terminos: Map<string, number> }>();
    for (const orden of this.ordenes()) {
      for (const detalle of orden.detalles) {
        if (this.esDetalleCompletado(detalle)) continue;
        if (!detalle.producto) continue;
        const precio = Number(detalle.precio_unitario ?? 0);
        const clave = `${detalle.producto.id}|${precio.toFixed(2)}`;
        const actual = productos.get(clave) ?? {
          etiqueta: `${detalle.producto.nombre}${precio > 0 ? ` ${formatCurrency(precio)}` : ''}`,
          cantidad: 0,
          terminos: new Map<string, number>(),
        };
        actual.cantidad += detalle.cantidad;
        for (const opcion of detalle.opciones ?? []) {
          const modificador = this.normalizar(opcion.modificador_opcion?.modificador?.nombre ?? '');
          if (modificador.includes('termino') || modificador.includes('coccion') || modificador.includes('punto')) {
            const termino = opcion.modificador_opcion?.nombre ?? 'Sin término';
            actual.terminos.set(termino, (actual.terminos.get(termino) ?? 0) + detalle.cantidad);
          }
        }
        productos.set(clave, actual);
      }
    }
    return [...productos.values()].map(item => ({
      etiqueta: item.etiqueta,
      cantidad: item.cantidad,
      terminos: [...item.terminos.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad })),
    }));
  });

  produccionCocina = computed(() => {
    const totales = new Map<string, { nombre: string; cantidad: number }>();
    const sumar = (clave: string, nombre: string, cantidad: number) => {
      const actual = totales.get(clave);
      totales.set(clave, { nombre, cantidad: (actual?.cantidad ?? 0) + cantidad });
    };
    for (const orden of this.ordenes()) {
      for (const detalle of orden.detalles) {
        if (this.esDetalleCompletado(detalle)) continue;
        if (!detalle.producto) continue;
        if (detalle.incluye_producto) sumar(`p-${detalle.producto.id}`, detalle.producto.nombre, detalle.cantidad);
        for (const opcion of detalle.opciones ?? []) {
          const seleccion = opcion.modificador_opcion;
          if (seleccion) sumar(`o-${seleccion.id}`, seleccion.nombre, detalle.cantidad);
        }
      }
    }
    return [...totales.values()].sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre));
  });

  tieneProduccionPendiente = computed(() => this.estacionActual()?.codigo === 'PARRILLA'
    ? this.produccionParrilla().length > 0
    : this.produccionCocina().length > 0);

  categorias = computed(() => {
    const categorias = new Set<string>();
    this.ordenes().forEach((orden) => orden.detalles.forEach((detalle) => {
      categorias.add(detalle.producto.categoria?.nombre || 'Sin categoría');
    }));
    return [...categorias].sort((a, b) => a.localeCompare(b));
  });

  ordenesVisibles = computed(() => {
    const categoria = this.categoriaSeleccionada();
    const texto = this.busqueda().trim().toLowerCase();

    return this.ordenes()
      .filter((orden) => {
        const coincideDetalleActivo = orden.detalles.some((detalle) => {
          const categoriaDetalle = detalle.producto.categoria?.nombre || 'Sin categoría';
          const coincideCategoria = categoria === 'todos' || categoriaDetalle === categoria;
          const contenido = `${orden.cliente?.nombre || ''} ${orden.numero_orden} ${detalle.producto.nombre}`.toLowerCase();
          return !this.esDetalleCompletado(detalle) && coincideCategoria && (!texto || contenido.includes(texto));
        });
        return coincideDetalleActivo || this.tieneCambiosRecientes(orden) || orden.estado === 'cancelado';
      });
  });

  ordenesCompletadas = computed(() => {
    const categoria = this.categoriaSeleccionada();
    const texto = this.busqueda().trim().toLowerCase();

    return this.ordenes().filter((orden) => {
      const detallesEnCategoria = orden.detalles.filter((detalle) =>
        categoria === 'todos' || (detalle.producto.categoria?.nombre || 'Sin categoría') === categoria
      );
      const contenido = `${orden.cliente?.nombre || ''} ${orden.numero_orden} ${orden.detalles.map((detalle) => detalle.producto.nombre).join(' ')}`.toLowerCase();
      return detallesEnCategoria.length > 0
        && orden.detalles.every((detalle) => this.esDetalleCompletado(detalle))
        && (!texto || contenido.includes(texto));
    });
  });

  ordenesTablero = computed(() => this.verServidos()
    ? this.ordenesCompletadas()
    : this.ordenesVisibles());

  ordenEnServicio = computed(() => {
    return this.ordenes().find((orden) =>
      orden.detalles.some((detalle) => ['en_preparacion', 'listo_para_recoger'].includes(detalle.estado_cocina))
    ) ?? null;
  });

  constructor(
    private cocinaService: CocinaService,
    private reverb: ReverbService,
    private authService: AuthService,
    private toastr: ToastrService,
    private router: Router,
    private route: ActivatedRoute,
    readonly themeService: ThemeService,
    @Inject(DOCUMENT) private readonly document: Document,
  ) {}

  ngOnInit(): void {
    this.themeService.initialize();
    this.cargarAlertasPreordenMostradas();
    this.syncFullscreenState();
    this.document.addEventListener('fullscreenchange', this.syncFullscreenState);
    // Chrome solo permite iniciar audio después de un toque o tecla del usuario.
    this.document.addEventListener('pointerdown', this.habilitarAlertasSonoras, { once: true });
    this.document.addEventListener('keydown', this.habilitarAlertasSonoras, { once: true });
    // Solo consulta IDs de preórdenes cada minuto; el tablero completo se
    // recarga únicamente si alguna cruzó la ventana de preparación.
    this.actualizacionPreordenTimer = setInterval(() => this.revisarPreordenesProximas(), 60000);
    this.authService.me().subscribe({
      next: (user: User) => {
        this.usuario.set(user);
        this.estacionId.set(user.estacion_id ?? null);
        this.estacionSolicitada.set(this.route.snapshot.paramMap.get('estacion'));
        this.cargarPedidos();
        this.escucharEventosReverb();
      },
      error: () => {
        this.estacionId.set(null);
        this.cargarPedidos();
        this.escucharEventosReverb();
      }
    });
    
  }

  toggleMobileFilters(): void {
    this.mobileFiltersOpen.update(open => !open);
  }

  toggleControles(): void {
    this.controlesOcultos.update(ocultos => !ocultos);
  }

  ngOnDestroy(): void {
    this.document.removeEventListener('fullscreenchange', this.syncFullscreenState);
    this.document.removeEventListener('pointerdown', this.habilitarAlertasSonoras);
    this.document.removeEventListener('keydown', this.habilitarAlertasSonoras);
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    if (this.sesionHeartbeat) clearInterval(this.sesionHeartbeat);
    if (this.actualizacionPreordenTimer) clearInterval(this.actualizacionPreordenTimer);
    void this.contextoAlertas?.close();
  }

  async toggleFullscreen(): Promise<void> {
    try {
      if (this.document.fullscreenElement) await this.document.exitFullscreen();
      else if (this.document.documentElement.requestFullscreen) await this.document.documentElement.requestFullscreen();
    } catch {
      // Algunos navegadores móviles pueden impedir este modo según su política.
    }
  }

  async salirDeCocina(): Promise<void> {
    if (this.document.fullscreenElement) {
      try { await this.document.exitFullscreen(); } catch { /* Se continúa con la salida. */ }
    }

    if (this.esAdministrador()) {
      await this.router.navigate(['/app/pedidos']);
      return;
    }

    this.authService.logout().subscribe({ error: () => undefined });
  }

  private escucharEventosReverb(): void {
    this.subscriptions.push(
      this.reverb.escucharCanal('canal-ordenes', '.OrdenCreada').subscribe((data: { tipo?: string; orden_id?: number }) => {
        if (data.orden_id) {
          this.cargarPedidos(false, false, data.orden_id);
          this.registrarActividadKds();
        }
      }),
      this.reverb.escucharCanal('canal-ordenes', '.OrdenCocinaActualizada').subscribe((data: { tipo?: string; orden_id?: number }) => {
        if (data.orden_id) {
          this.cargarPedidos(false, true);
        }
      }),
      this.reverb.escucharCanal('canal-ordenes', '.PreordenActualizada').subscribe(() => {
        this.cargarPedidos(false);
        this.registrarActividadKds();
      }),
      this.reverb.escucharCanal('canal-ordenes', '.KdsColaActualizada').subscribe(() => this.cargarPedidos(false)),
    );
  }

  cargarPedidos(mostrarCarga = true, detectarDesbloqueos = false, alertarNuevaOrdenId?: number): void {
    if (mostrarCarga) this.isLoading.set(true);
    const bloqueadosAntes = new Set(this.ordenes().flatMap(orden =>
      orden.detalles.filter(detalle => detalle.bloqueado).map(detalle => detalle.id)
    ));
    this.cocinaService.obtenerPedidos(this.fechaSeleccionada(), this.estacionSolicitada()).subscribe({
      next: (res) => {
        const ordenes = res.ordenes || [];
        this.estacionActual.set(res.estacion);
        this.estacionId.set(res.estacion.id);
        this.estacionesDisponibles.set(res.estaciones_disponibles || []);
        this.ordenes.set(ordenes);
        this.preordenesProgramadas.set(res.preordenes_programadas || []);
        if (res.estacion.codigo === 'PARRILLA') this.avisarPreordenesTempranas(ordenes);
        if (alertarNuevaOrdenId) this.avisarNuevaOrden(ordenes, alertarNuevaOrdenId, res.estacion);
        this.iniciarSesionKds(res.estacion.id);
        if (detectarDesbloqueos && res.estacion.codigo === 'COCINA') {
          const desbloqueados = ordenes.flatMap(orden => orden.detalles)
            .filter(detalle => detalle.listo_para_atender && bloqueadosAntes.has(detalle.id));
          desbloqueados.forEach(detalle => {
            const guarniciones = (detalle.opciones ?? []).map(opcion => opcion.modificador_opcion?.nombre).filter(Boolean).join(' · ');
            this.toastr.info(
              `${detalle.producto.nombre}${guarniciones ? ' · ' + guarniciones : ''}`,
              'Guarnición lista para atender',
              { timeOut: 5000, progressBar: true }
            );
          });
        }
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  seleccionarEstacion(estacion: KdsEstacion): void {
    this.estacionSolicitada.set(estacion.codigo.toLowerCase());
    this.categoriaSeleccionada.set('todos');
    this.router.navigate(['/cocina', estacion.codigo.toLowerCase()]);
    this.cargarPedidos();
  }

  private iniciarSesionKds(estacionId: number): void {
    if (this.estacionSesionId === estacionId) return;
    this.estacionSesionId = estacionId;
    if (this.sesionHeartbeat) clearInterval(this.sesionHeartbeat);
    this.sesionHeartbeat = setInterval(() => this.registrarActividadKds(), 60000);
    this.registrarActividadKds();
  }

  private registrarActividadKds(): void {
    const estacionId = this.estacionSesionId;
    if (!estacionId) return;
    this.cocinaService.registrarSesion(estacionId).subscribe({ error: () => undefined });
  }

  private revisarPreordenesProximas(): void {
    if (this.estacionActual()?.codigo !== 'PARRILLA') return;

    this.cocinaService.obtenerPreordenesProximas(this.fechaSeleccionada(), this.estacionSolicitada()).subscribe({
      next: ({ ids }) => {
        const actuales = this.ordenes().filter(orden => orden.preorden_temprana).map(orden => orden.id).sort((a, b) => a - b);
        const proximas = [...ids].sort((a, b) => a - b);
        if (actuales.length !== proximas.length || actuales.some((id, indice) => id !== proximas[indice])) {
          this.cargarPedidos(false);
        }
      },
      error: () => undefined,
    });
  }

  onFechaChange(event: Event): void {
    this.fechaSeleccionada.set((event.target as HTMLInputElement).value);
    this.cargarPedidos();
  }

  onCategoriaChange(event: Event): void {
    this.categoriaSeleccionada.set((event.target as HTMLSelectElement).value);
  }

  onBusquedaChange(event: Event): void {
    this.busqueda.set((event.target as HTMLInputElement).value);
  }

  resumenPreorden(orden: KdsOrden): string {
    const productos = new Map<string, { cantidad: number; nombre: string; precio: number }>();
    orden.detalles.forEach(detalle => {
      if (!detalle.producto) return;
      const precio = Number(detalle.precio_unitario ?? 0);
      const clave = `${detalle.producto.id}|${precio}`;
      const actual = productos.get(clave) ?? { cantidad: 0, nombre: detalle.producto.nombre, precio };
      actual.cantidad += detalle.cantidad;
      productos.set(clave, actual);
    });
    return [...productos.values()]
      .map(item => `${item.cantidad} × ${item.nombre}${item.precio > 0 ? ` · ${formatCurrency(item.precio)}` : ''}`)
      .join(' · ');
  }

  private avisarPreordenesTempranas(ordenes: KdsOrden[]): void {
    const nuevas = ordenes.filter(orden => orden.preorden_temprana && !this.preordenesAlertadas.has(this.claveAlertaPreorden(orden)));
    if (!nuevas.length) return;

    nuevas.forEach(orden => {
      this.preordenesAlertadas.add(this.claveAlertaPreorden(orden));
      const hora = orden.fecha_programada ? new Date(orden.fecha_programada).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) : '';
      this.toastr.warning(
        `#${orden.numero_orden || orden.id} · ${orden.cliente?.nombre || 'Cliente pendiente'}${hora ? ` · ${hora}` : ''}`,
        'Preorden para preparar en Parrilla',
        { timeOut: 8000, progressBar: true, enableHtml: false }
      );
    });
    this.guardarAlertasPreordenMostradas();
    this.reproducirAlertaPreorden();
  }

  private avisarNuevaOrden(ordenes: KdsOrden[], ordenId: number, estacion: KdsEstacion): void {
    if (this.ordenesAlertadas.has(ordenId)) return;
    const orden = ordenes.find(item => item.id === ordenId && !item.preorden_temprana);
    if (!orden) return;

    this.ordenesAlertadas.add(ordenId);
    const cantidad = orden.detalles.reduce((total, detalle) => total + detalle.cantidad, 0);
    this.toastr.info(
      `#${orden.numero_orden || orden.id} · ${orden.cliente?.nombre || 'Cliente pendiente'} · ${cantidad} producto${cantidad === 1 ? '' : 's'}`,
      `Nuevo pedido para ${estacion.nombre}`,
      { timeOut: 7000, progressBar: true, enableHtml: false }
    );
    this.reproducirTono([523, 659, 784]);
  }

  private claveAlertaPreorden(orden: KdsOrden): string {
    return `${orden.id}:${orden.fecha_programada ?? ''}`;
  }

  private cargarAlertasPreordenMostradas(): void {
    try {
      const guardadas = JSON.parse(sessionStorage.getItem(this.claveAlertasPreorden) ?? '[]');
      if (Array.isArray(guardadas)) this.preordenesAlertadas = new Set(guardadas.filter((clave): clave is string => typeof clave === 'string'));
    } catch {
      this.preordenesAlertadas.clear();
    }
  }

  private guardarAlertasPreordenMostradas(): void {
    try {
      sessionStorage.setItem(this.claveAlertasPreorden, JSON.stringify([...this.preordenesAlertadas]));
    } catch {
      // Si el navegador impide guardar la sesión, el tablero sigue funcionando.
    }
  }

  private reproducirAlertaPreorden(): void {
    this.reproducirTono([784, 1046]);
  }

  private reproducirTono(frecuencias: number[]): void {
    if (!this.alertasSonorasHabilitadas || this.contextoAlertas?.state !== 'running') return;

    try {
      const contexto = this.contextoAlertas;
      if (!contexto) return;
      const inicio = contexto.currentTime;
      frecuencias.forEach((frecuencia, indice) => {
        const retraso = indice * .18;
        const tono = contexto.createOscillator();
        const volumen = contexto.createGain();
        tono.type = 'sine';
        tono.frequency.value = frecuencia;
        volumen.gain.setValueAtTime(.0001, inicio + retraso);
        volumen.gain.exponentialRampToValueAtTime(.13, inicio + retraso + .02);
        volumen.gain.exponentialRampToValueAtTime(.0001, inicio + retraso + .16);
        tono.connect(volumen).connect(contexto.destination);
        tono.start(inicio + retraso);
        tono.stop(inicio + retraso + .15);
      });
    } catch {
      // El aviso visual se mantiene si el equipo no puede reproducir el tono.
    }
  }

  gruposPorCategoria(orden: KdsOrden): Array<{ categoria: string; grupos: KdsDetalleAgrupado[] }> {
    const grupos = new Map<string, KdsDetalle[]>();
    orden.detalles.filter((detalle) => !!detalle.producto && (this.verServidos()
      ? this.esDetalleCompletado(detalle)
      : !this.esDetalleCompletado(detalle)
    )).forEach((detalle) => {
      const categoria = detalle.producto.categoria?.nombre || 'Sin categoría';
      grupos.set(categoria, [...(grupos.get(categoria) || []), detalle]);
    });
    return [...grupos.entries()].map(([categoria, detalles]) => ({
      categoria,
      grupos: this.agruparDetalles(detalles),
    }));
  }

  detallesCompletados(orden: KdsOrden): KdsDetalle[] {
    return orden.detalles.filter((detalle) => this.esDetalleCompletado(detalle));
  }

  gruposCompletados(orden: KdsOrden): KdsDetalleAgrupado[] {
    return this.agruparDetalles(this.detallesCompletados(orden));
  }

  detallesDelGrupo(grupo: KdsDetalleAgrupado): KdsDetalle[] {
    return grupo.estados.flatMap((estado) => estado.detalles);
  }

  toggleVerServidos(): void {
    this.verServidos.update((activo) => !activo);
  }

  toggleDetallesCompletados(ordenId: number): void {
    this.detallesCompletadosAbiertos.update((estado) => ({
      ...estado,
      [ordenId]: !estado[ordenId],
    }));
  }

  detallesCompletadosAbiertosPara(ordenId: number): boolean {
    return this.detallesCompletadosAbiertos()[ordenId] === true;
  }

  private agruparDetalles(detalles: KdsDetalle[]): KdsDetalleAgrupado[] {
    const grupos = new Map<string, KdsDetalleAgrupado>();

    for (const detalle of detalles) {
      const opciones = (detalle.opciones ?? [])
        .map(opcion => opcion.modificador_opcion)
        .filter((opcion): opcion is NonNullable<typeof opcion> => !!opcion)
        .sort((a, b) => a.id - b.id);
      const clave = [
        detalle.producto.id,
        Number(detalle.precio_unitario ?? 0).toFixed(2),
        detalle.nota?.trim() ?? '',
        detalle.estacion_id ?? '',
        detalle.incluye_producto ? 'producto' : 'opcion',
        opciones.map(opcion => opcion.id).join(','),
      ].join('|');
      const estado = this.estadoAgrupado(detalle);
      const actual = grupos.get(clave) ?? {
        clave,
        cantidad: 0,
        producto: detalle.producto,
        nota: detalle.nota,
        opciones: opciones.map(opcion => opcion.nombre),
        estados: [],
        tieneListos: false,
        todosBloqueados: true,
      };
      const estadoActual = actual.estados.find(item => item.clave === estado.clave);

      if (estadoActual) {
        estadoActual.cantidad += detalle.cantidad;
        estadoActual.detalles.push(detalle);
      } else {
        actual.estados.push({ ...estado, cantidad: detalle.cantidad, detalles: [detalle] });
      }

      actual.cantidad += detalle.cantidad;
      actual.tieneListos ||= detalle.listo_para_atender === true;
      actual.todosBloqueados &&= detalle.bloqueado === true;
      grupos.set(clave, actual);
    }

    return [...grupos.values()];
  }

  private estadoAgrupado(detalle: KdsDetalle): Omit<KdsDetalleEstadoAgrupado, 'cantidad' | 'detalles'> {
    if (detalle.bloqueado) {
      return { clave: 'bloqueado', etiqueta: 'Bloqueado · esperando Parrilla', bloqueado: true, listoParaAtender: false };
    }
    if (detalle.listo_para_atender) {
      return { clave: 'listo-para-atender', etiqueta: 'Listo para atender', bloqueado: false, listoParaAtender: true };
    }

    const etiquetas: Record<KdsDetalle['estado_cocina'], string> = {
      pendiente: 'Pendiente',
      en_preparacion: 'En preparación',
      listo_para_recoger: 'Listo para recoger',
      recogido: 'Recogido',
      servido: 'Servido',
    };
    return {
      clave: detalle.estado_cocina,
      etiqueta: etiquetas[detalle.estado_cocina],
      bloqueado: false,
      listoParaAtender: false,
    };
  }

  marcarServido(detalle: KdsDetalle, servido: boolean): void {
    if (detalle.bloqueado) return;
    const estacionId = this.estacionActual()?.id;
    if (!estacionId) return;
    this.detalleActualizando.set(detalle.id);
    this.cocinaService.actualizarEstadoDetalle(detalle.id, estacionId, servido ? 'servido' : 'pendiente').subscribe({
      next: (respuesta) => {
        this.detalleActualizando.set(null);
        this.cargarPedidos(false);
      },
      error: (error) => {
        this.detalleActualizando.set(null);
        this.toastr.warning(
          error?.error?.message || 'No se pudo cambiar el estado del producto.'
        );
        this.cargarPedidos(false);
      },
    });
  }

  private esDetalleCompletado(detalle: KdsDetalle): boolean {
    return detalle.estado_cocina === 'servido';
  }

  /**
   * Integra una orden recibida por Reverb sin volver a consultar el tablero.
   * Si todos sus productos ya fueron servidos, se elimina del KDS.
   */
  private insertarOActualizarOrden(orden: KdsOrden, cambios: KdsCambioOrden[] = []): void {
    const ordenFiltrada = this.filtrarOrdenPorEstacion(orden);
    this.ordenes.update((ordenes) => {
      const anterior = ordenes.find((item) => item.id === ordenFiltrada.id);
      const sinOrdenActual = ordenes.filter((item) => item.id !== ordenFiltrada.id);

      if (!this.debeMostrarseEnKds(ordenFiltrada)) {
        console.log('Orden eliminada del KDS:', ordenFiltrada.id);
        return sinOrdenActual;
      }

      const ordenConCambios: KdsOrden = {
        ...ordenFiltrada,
        cambios_recientes: cambios.length > 0 ? cambios : anterior?.cambios_recientes || [],
      };

      return [...sinOrdenActual, ordenConCambios].sort((a, b) => {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    });
  }

  /** Actualiza solo el detalle confirmado por la API, sin recargar la lista completa. */
  private actualizarDetalleLocal(respuesta: ActualizacionEstadoCocinaResponse): void {
    this.ordenes.update((ordenes) => {
      return ordenes
        .map((orden) => {
          if (orden.id !== respuesta.orden_id) {
            return orden;
          }

          return {
            ...orden,
            estado: respuesta.orden_estado,
            detalles: orden.detalles.map((detalle) => {
              return detalle.id === respuesta.detalle.id ? respuesta.detalle : detalle;
            }),
          };
        })
        .filter((orden) => this.tieneDetallesParaKds(orden));
    });
  }

  private tieneDetallesPendientes(orden: KdsOrden): boolean {
    return orden.detalles.some((detalle) => detalle.estado_cocina === 'pendiente');
  }

  private tieneDetallesParaKds(orden: KdsOrden): boolean {
    return orden.detalles.some((detalle) =>
      ['pendiente', 'en_preparacion', 'listo_para_recoger', 'servido'].includes(detalle.estado_cocina)
    );
  }

  private debeMostrarseEnKds(orden: KdsOrden): boolean {
    if (!this.esDeFechaSeleccionada(orden)) {
      console.log('Orden ignorada por fecha:', orden.id, orden.created_at);
      return false;
    }

    const cuentaDetalles = orden.detalles.length > 0;
    const pendientes = this.tieneDetallesParaKds(orden);
    const tieneEstacionAsignada = this.estacionId() !== null;

    if (tieneEstacionAsignada) {
      return cuentaDetalles && (pendientes || orden.estado === 'cancelado');
    }

    return orden.estado === 'cancelado' || (['pendiente', 'preparando', 'listo'].includes(orden.estado) && pendientes);
  }

  aceptarCambios(ordenId: number): void {
    this.ordenes.update((ordenes) => ordenes.map((orden) => {
      return orden.id === ordenId ? { ...orden, cambios_recientes: [] } : orden;
    }));
  }

  aceptarCancelacion(ordenId: number): void {
    this.ordenes.update((ordenes) => ordenes.filter((orden) => orden.id !== ordenId));
  }

  tieneCambiosRecientes(orden: KdsOrden): boolean {
    return (orden.cambios_recientes?.length || 0) > 0;
  }

  nombreProductoCambio(cambio: KdsCambioOrden): string {
    return cambio.producto?.nombre
      || cambio.datos_nuevo?.producto_nombre
      || cambio.datos_anterior?.producto_nombre
      || 'Producto';
  }

  etiquetaCambio(cambio: KdsCambioOrden): string {
    const anterior = cambio.cantidad_anterior ?? cambio.datos_anterior?.cantidad ?? 0;
    const nueva = cambio.cantidad_nueva ?? cambio.datos_nuevo?.cantidad ?? 0;
    const producto = this.nombreProductoCambio(cambio);

    if (cambio.tipo_cambio === 'detalle_agregado') return `Producto agregado: ${producto} × ${nueva}`;
    if (cambio.tipo_cambio === 'detalle_eliminado') return `Producto eliminado: ${producto} × ${anterior}`;
    if (cambio.tipo_cambio === 'orden_cancelada') return 'La orden fue cancelada';
    if (cambio.tipo_cambio === 'estado_cambiado') return 'El estado de la orden fue actualizado';
    if (nueva > anterior) return `${producto}: cantidad aumentó de ${anterior} a ${nueva}`;
    if (nueva < anterior) return `${producto}: cantidad disminuyó de ${anterior} a ${nueva}`;
    return `${producto}: detalle actualizado`;
  }

  claseCambio(cambio: KdsCambioOrden): string {
    if (cambio.tipo_cambio === 'detalle_agregado') return 'change--added';
    if (cambio.tipo_cambio === 'detalle_eliminado' || cambio.tipo_cambio === 'orden_cancelada') return 'change--removed';
    const anterior = cambio.cantidad_anterior ?? cambio.datos_anterior?.cantidad ?? 0;
    const nueva = cambio.cantidad_nueva ?? cambio.datos_nuevo?.cantidad ?? 0;
    return nueva > anterior ? 'change--increased' : 'change--reduced';
  }

  private filtrarOrdenPorEstacion(orden: KdsOrden): KdsOrden {
    const estacionId = this.estacionId();
    if (estacionId === null) {
      return orden;
    }

    // Comparar tipos y valores en una muestra para depuración
    const muestra = (orden.detalles || []).slice(0, 3).map(d => ({
      detalle_id: d.id,
      detalle_estacion_id: d.estacion_id,
      tipo_detalle_estacion_id: typeof d.estacion_id,
      estacionId_value: estacionId,
      tipo_estacionId: typeof estacionId,
      strict_equal: d.estacion_id === estacionId,
      loose_equal: d.estacion_id == estacionId,
    }));
    console.log('filtrarOrdenPorEstacion debug', { orden_id: orden.id, muestra });

    return {
      ...orden,
      detalles: orden.detalles.filter((detalle) => detalle.estacion_id === estacionId),
    };
  }

  private esDeFechaSeleccionada(orden: KdsOrden): boolean {
    //return (orden.created_at || '').slice(0, 10) === this.fechaSeleccionada();
    if (!orden.created_at) return false;
    
    // 1. Convertir el texto ISO/UTC a un objeto Date nativo (se adapta automáticamente a la hora local)
    const fechaOrdenLocal = new Date(orden.created_at);
    
    // 2. Formatear en estructura YYYY-MM-DD usando los métodos locales
    const anio = fechaOrdenLocal.getFullYear();
    const mes = String(fechaOrdenLocal.getMonth() + 1).padStart(2, '0');
    const dia = String(fechaOrdenLocal.getDate()).padStart(2, '0');
    
    const fechaOrdenFormateada = `${anio}-${mes}-${dia}`;

    // 3. Comparar ambos strings en base a la hora local
    return fechaOrdenFormateada === this.fechaSeleccionada();
  }

  tiempoTranscurrido(orden: KdsOrden): string {
    const fecha = new Date(orden.fecha_orden || orden.created_at);
    const minutos = Math.max(0, Math.floor((Date.now() - fecha.getTime()) / 60000));
    if (minutos < 1) return 'Ahora';
    if (minutos < 60) return `${minutos} min`;

    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;
    return minutosRestantes ? `${horas}h ${minutosRestantes}m` : `${horas}h`;
  }

  esUrgente(orden: KdsOrden): boolean {
    const fecha = new Date(orden.fecha_orden || orden.created_at);
    return Date.now() - fecha.getTime() >= 15 * 60 * 1000;
  }

  etiquetaTipoOrden(orden: KdsOrden): string {
    return orden.tipo_orden === 'dine-in' ? `Mesa ${orden.mesa?.numero || '—'}` : orden.tipo_orden === 'delivery' ? 'Delivery' : 'Para llevar';
  }

  private normalizar(valor: string): string {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  private readonly syncFullscreenState = (): void => {
    this.isFullscreen.set(!!this.document.fullscreenElement);
  };

  private fechaDeHoy(): string {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  }

}
