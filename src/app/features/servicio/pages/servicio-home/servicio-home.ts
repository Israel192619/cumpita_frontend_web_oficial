import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, HostListener, OnDestroy, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../../../core/services/auth-service';
import { ReverbService } from '../../../../core/services/reverb-service';
import { OrdenServicioDetalle, OrdenServicioResumen, ServicioFicha, ServicioService, ServicioSesion, ServicioTablero, SolicitudPreorden } from '../../services/servicio-service';
import { Button } from '../../../../shared/components/button/button';
import { InputForm } from '../../../../shared/components/input-form/input-form';
import { Modal } from '../../../../shared/components/modal/modal';
import { Producto, ModificadorEstructurado, ModificadorOpcion } from '../../../../core/models/producto';
import { ThemeService } from '../../../../core/services/theme-service';
import { Icon } from '../../../../shared/components/icon/icon';
import { formatCurrency } from '../../../../core/config/currency.config';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog-service';
import { LocationMap, MapLocation } from '../../../../shared/components/location-map/location-map';
import { ConfiguracionService } from '../../../../core/services/configuracion-service';

interface Mesero { id: number; name: string; }
interface GrupoDetalleServicio {
  clave: string;
  categoria: string;
  inicioCategoria?: boolean;
  cantidad: number;
  producto: string;
  precioUnitario: number;
  opciones: string[];
  nota?: string | null;
  listo: boolean;
  detalles: ServicioFicha['detalles'];
}

@Component({
  selector: 'app-servicio-home',
  imports: [RouterLink, CommonModule, ReactiveFormsModule, Button, InputForm, Modal, Icon, LocationMap],
  templateUrl: './servicio-home.html',
  styleUrls: ['./servicio-home.css', './servicio-theme.css']
})
export class ServicioHome implements OnInit, OnDestroy {
  menuUsuarioAbierto = signal(false);
  avatarFallido = signal(false);
  usuarioCabecera = computed(() => this.auth.usuarioActual());

  @HostListener('document:click', ['$event'])
  cerrarMenuUsuarioFuera(event: MouseEvent): void {
    const menu = this.elementRef.nativeElement.querySelector('.service-user-menu');
    if (this.menuUsuarioAbierto() && menu && !menu.contains(event.target as Node)) {
      this.menuUsuarioAbierto.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  cerrarMenuUsuarioEscape(): void {
    if (!this.menuUsuarioAbierto()) return;
    this.menuUsuarioAbierto.set(false);
    this.elementRef.nativeElement.querySelector<HTMLButtonElement>('.service-user-trigger')?.focus();
  }

  pantallaCompleta = signal(!!document.fullscreenElement);

  @HostListener('document:fullscreenchange')
  actualizarPantallaCompleta(): void {
    this.pantallaCompleta.set(!!document.fullscreenElement);
  }

  async alternarPantallaCompleta(): Promise<void> {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
      this.actualizarPantallaCompleta();
    } catch {
      this.toastr.warning('No se pudo cambiar a pantalla completa en este navegador.');
    }
  }
  sesiones = signal<ServicioSesion[]>([]);
  sesionSeleccionada = signal<ServicioSesion | null>(null);
  disponibles = signal<ServicioFicha[]>([]);
  misFichas = signal<ServicioFicha[]>([]);
  misEntregadas = signal<ServicioFicha[]>([]);
  viendoEntregadas = signal(false);
  viendoTodas = signal(false);
  todasFichas = signal<ServicioFicha[]>([]);
  filtroTodas = signal('');
  todasFiltradas = computed(() => {
    const consulta = this.filtroTodas().trim().toLocaleLowerCase();
    return this.todasFichas().filter(ficha =>
      !consulta || [ficha.numero_orden, ficha.mesa, ficha.cliente, ficha.mesero].join(' ').toLocaleLowerCase().includes(consulta)
    );
  });
  preordenesProgramadas = signal<ServicioFicha[]>([]);
  preordenesAbiertas = signal(false);
  solicitudes = signal<SolicitudPreorden[]>([]);
  solicitudesVencidas = signal<SolicitudPreorden[]>([]);
  solicitudesAbiertas = signal(false);
  motivoRechazo = signal('');
  consultaPreorden = signal('');
  meseros = signal<Mesero[]>([]);
  meseroSeleccionado = signal<Mesero | null>(null);
  mostrarIngreso = signal(false);
  loading = signal(true);
  procesando = signal<string | null>(null);
  confirmacionesPendientes = signal<Set<number>>(new Set());
  errorIngreso = signal<string | null>(null);
  confirmarCierre = signal(false);
  permiteSesionesPin = signal(false);
  esAccesoPrincipal = signal(false);
  esAdministrador = signal(false);
  esDespacho = signal(false);
  esMesero = signal(false);
  fichaALiberar = signal<ServicioFicha | null>(null);
  fichaUbicacion = signal<ServicioFicha | null>(null);
  editandoUbicacion = signal(false);
  eliminandoFotoUbicacion = signal(false);
  ubicacionForm = new FormGroup({
    direccion: new FormControl(''),
    referencia_ubicacion: new FormControl(''),
    latitud: new FormControl<number | null>(null),
    longitud: new FormControl<number | null>(null),
    foto_local: new FormControl<File | null>(null),
  });
  buscarOrdenAbierto = signal(false);
  consultaOrden = signal('');
  resultadosOrden = signal<OrdenServicioResumen[]>([]);
  ordenSeleccionada = signal<OrdenServicioDetalle | null>(null);
  productos = signal<Producto[]>([]);
  selectorProductoAbierto = signal(false);
  productoSeleccionado = signal<Producto | null>(null);
  busquedaProducto = signal('');
  cantidadAdicional = signal(1);
  opcionesSeleccionadas = signal<number[]>([]);
  notaAdicional = signal('');
  readonly fechaHoy = this.fechaLocal(new Date());
  fechaTablero = signal(this.fechaHoy);
  meserosDisponibles = computed(() => {
    const idsConSesion = new Set(this.sesiones().map(sesion => sesion.user.id));
    return this.meseros().filter(mesero => !idsConSesion.has(mesero.id));
  });
  productosFiltrados = computed(() => {
    const q = this.busquedaProducto().trim().toLowerCase();
    return this.productos().filter(producto => !q || `${producto.nombre} ${producto.descripcion ?? ''}`.toLowerCase().includes(q));
  });
  preordenesFiltradas = computed(() => {
    const q = this.consultaPreorden().trim().toLocaleLowerCase();
    if (!q) return this.preordenesProgramadas();
    return this.preordenesProgramadas().filter(ficha =>
      `#${ficha.numero_orden} ${ficha.numero_orden} ${ficha.cliente ?? ''} ${ficha.mesa ?? ''} ${this.etiquetaTipo(ficha)}`
        .toLocaleLowerCase().includes(q)
    );
  });
  pin = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{4,6}$/)] });
  private subs: Subscription[] = [];
  private cargaSub?: Subscription;
  private sesionPrincipal?: ServicioSesion;
  private cerrandoSesion = false;
  private sesiones401Notificadas = new Set<string>();
  private actualizacionesLocales = new Map<number, { cantidad: number; fecha: number }>();
  private readonly consultaOrdenCambios = new Subject<string>();
  private consultaOrdenSub?: Subscription;
  private busquedaOrdenSecuencia = 0;
  private temporizadorBusquedaProducto?: ReturnType<typeof setTimeout>;
  private readonly tableroPorSesion = new Map<string, Pick<ServicioTablero, 'mis_fichas' | 'mis_entregadas'>>();
  private contextoAvisos?: AudioContext;
  private avisosSonorosHabilitados = false;
  private readonly habilitarAvisosSonoros = (): void => {
    if (this.contextoAvisos) return;
    try {
      const contexto = new AudioContext();
      void contexto.resume().then(() => {
        this.contextoAvisos = contexto;
        this.avisosSonorosHabilitados = contexto.state === 'running';
      }).catch(() => void contexto.close());
    } catch { /* El toaster continúa visible si el dispositivo no admite audio. */ }
  };

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private servicio: ServicioService,
    private auth: AuthService,
    private reverb: ReverbService,
    private toastr: ToastrService,
    private router: Router,
    private route: ActivatedRoute,
    readonly themeService: ThemeService,
    private confirmDialog: ConfirmDialogService,
    readonly configuracion: ConfiguracionService,
  ) {}

  ngOnInit(): void {
    this.themeService.initialize();
    this.configuracion.cargar().subscribe({ error: () => undefined });
    document.addEventListener('pointerdown', this.habilitarAvisosSonoros, { once: true });
    document.addEventListener('keydown', this.habilitarAvisosSonoros, { once: true });
    this.consultaOrdenSub = this.consultaOrdenCambios.pipe(debounceTime(180), distinctUntilChanged()).subscribe(() => this.buscarOrdenes());
    this.auth.me().subscribe({
      next: usuario => {
        const rol = (usuario.role?.nombre ?? '').trim().toLocaleLowerCase();
        this.esAdministrador.set(['admin', 'administrador', 'gerente'].includes(rol));
        this.esDespacho.set(rol === 'despacho');
        this.esMesero.set(rol === 'mesero');
        if (rol === 'mesero') {
          const principal: ServicioSesion = {
            session_id: `principal-${usuario.id}`,
            expires_at: Number.MAX_SAFE_INTEGER,
            user: { id: usuario.id, name: usuario.name },
            principal: true
          };
          this.sesionPrincipal = principal;
          this.esAccesoPrincipal.set(true);
          this.sesiones.set([principal]);
          this.sesionSeleccionada.set(principal);
        } else {
          const sesiones = this.servicio.sesionesGuardadas();
          this.permiteSesionesPin.set(rol === 'despacho');
          this.sesiones.set(rol === 'despacho' ? sesiones : []);
          this.sesionSeleccionada.set(rol === 'despacho' ? sesiones[0] ?? null : null);
        }
        this.activarTiempoReal();
        this.cargar();
        this.cargarSolicitudes();
        if (this.esMesero() && this.route.snapshot.queryParamMap.get('solicitudes') === 'true') {
          this.solicitudesAbiertas.set(true);
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { solicitudes: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }
      },
      error: () => this.router.navigate(['/login'])
    });
  }

  ngOnDestroy(): void {
    if (this.temporizadorBusquedaProducto) clearTimeout(this.temporizadorBusquedaProducto);
    this.consultaOrdenSub?.unsubscribe();
    this.detenerActividadAutomatica();
    document.removeEventListener('pointerdown', this.habilitarAvisosSonoros);
    document.removeEventListener('keydown', this.habilitarAvisosSonoros);
    void this.contextoAvisos?.close();
  }

  volverAOrdenes(): void {
    this.router.navigate(['/app/pedidos']);
  }

  crearPreorden(): void {
    this.router.navigate(['/preordenes/nueva']);
  }

  cerrarSesionAplicacion(): void {
    this.menuUsuarioAbierto.set(false);
    if (this.esMesero()) {
      this.cerrarMiSesion();
      return;
    }
    this.auth.logout().subscribe({ error: () => undefined });
  }

  abrirBuscadorOrden(): void {
    if (!this.sesionSeleccionada()) { this.toastr.warning('Selecciona una sesión de Mesero.'); return; }
    this.buscarOrdenAbierto.set(true);
    this.resultadosOrden.set([]);
    this.ordenSeleccionada.set(null);
    this.consultaOrden.set('');
  }

  abrirOrdenDesdeFicha(ficha: ServicioFicha): void {
    this.buscarOrdenAbierto.set(true);
    this.resultadosOrden.set([]);
    this.seleccionarOrden({
      id: ficha.id,
      numero_orden: ficha.numero_orden,
      mesa: ficha.mesa,
      cliente: ficha.cliente,
      tipo_orden: ficha.tipo_orden,
      estado: '',
      puede_agregar: true,
    });
  }

  cerrarBuscadorOrden(): void {
    this.buscarOrdenAbierto.set(false);
    this.selectorProductoAbierto.set(false);
    this.productoSeleccionado.set(null);
  }

  abrirPreordenes(): void {
    this.consultaPreorden.set('');
    this.preordenesAbiertas.set(true);
  }

  abrirSolicitudes(): void { this.solicitudesAbiertas.set(true); this.cargarSolicitudes(); }

  cargarSolicitudes(): void {
    if (!this.esMesero()) return;
    this.servicio.listarSolicitudes(this.sesionSeleccionada()?.token).subscribe({ next: r => { this.solicitudes.set(r.solicitudes ?? []); this.solicitudesVencidas.set(r.vencidas ?? []); }, error: () => undefined });
  }

  aceptarSolicitud(solicitud: SolicitudPreorden): void {
    this.confirmDialog.confirm({ title: 'Aceptar solicitud', message: `¿Confirmas la preorden de ${solicitud.cliente}? El stock reservado se descontará y la preorden quedará programada.`, confirmText: 'Aceptar preorden', confirmColor: 'success' }).subscribe(confirmado => {
      if (!confirmado) return;
    this.procesando.set(`aceptar-solicitud-${solicitud.id}`);
    this.servicio.aceptarSolicitud(solicitud.id, this.sesionSeleccionada()?.token).subscribe({
      next: () => { this.procesando.set(null); this.solicitudes.update(items => items.filter(x => x.id !== solicitud.id)); this.toastr.success('Solicitud aceptada. Ya aparece como preorden programada.'); this.cargar(false); },
      error: e => { this.procesando.set(null); this.toastr.error(e?.error?.message || 'No se pudo aceptar la solicitud.'); this.cargarSolicitudes(); }
    });
    });
  }

  rechazarSolicitud(solicitud: SolicitudPreorden): void {
    this.confirmDialog.confirm({ title: 'Rechazar solicitud', message: `¿Confirmas que deseas rechazar la solicitud de ${solicitud.cliente}? Se liberará el stock reservado.`, confirmText: 'Rechazar solicitud', confirmColor: 'danger' }).subscribe(confirmado => {
      if (!confirmado) return;
    this.procesando.set(`rechazar-solicitud-${solicitud.id}`);
    this.servicio.rechazarSolicitud(solicitud.id, this.motivoRechazo(), this.sesionSeleccionada()?.token).subscribe({
      next: () => { this.procesando.set(null); this.motivoRechazo.set(''); this.solicitudes.update(items => items.filter(x => x.id !== solicitud.id)); this.toastr.info('Solicitud rechazada.'); },
      error: e => { this.procesando.set(null); this.toastr.error(e?.error?.message || 'No se pudo rechazar la solicitud.'); }
    });
    });
  }

  reactivarSolicitud(solicitud: SolicitudPreorden): void {
    this.procesando.set(`revisar-solicitud-${solicitud.id}`);
    this.servicio.disponibilidadSolicitud(solicitud.id, this.sesionSeleccionada()?.token).subscribe({
      next: resultado => {
        this.procesando.set(null);
        if (!resultado.hora_valida) {
          const minima = new Date(resultado.hora_minima).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
          this.confirmDialog.confirm({ title: 'Debes cambiar la hora', message: `La hora solicitada ya no deja 20 minutos completos de preparación. El horario mínimo ahora es ${minima}.`, confirmText: 'Editar solicitud', cancelText: 'Cancelar', confirmColor: 'warning' })
            .subscribe(editar => { if (editar) this.abrirEdicionSolicitud(solicitud, resultado.faltantes); });
          return;
        }
        if (!resultado.disponible) {
          const detalle = resultado.faltantes.map(item => `${item.nombre}: necesita ${item.necesarias}, hay ${item.disponibles}`).join('. ');
          this.confirmDialog.confirm({ title: 'Stock insuficiente', message: `${detalle}. Puedes editar la solicitud para acordar reemplazos o reducir cantidades.`, confirmText: 'Editar solicitud', cancelText: 'Cancelar', confirmColor: 'warning' })
            .subscribe(editar => { if (editar) this.abrirEdicionSolicitud(solicitud, resultado.faltantes); });
          return;
        }
        this.confirmDialog.confirm({ title: 'Reactivar solicitud', message: 'Hay stock suficiente. ¿Deseas reservarlo nuevamente durante 20 minutos?', confirmText: 'Reactivar 20 min', confirmColor: 'success' })
          .subscribe(confirmado => { if (confirmado) this.confirmarReactivacion(solicitud); });
      },
      error: e => { this.procesando.set(null); this.toastr.error(e?.error?.message || 'No se pudo comprobar el stock.'); }
    });
  }

  editarSolicitud(solicitud: SolicitudPreorden): void {
    this.procesando.set(`revisar-solicitud-${solicitud.id}`);
    this.servicio.disponibilidadSolicitud(solicitud.id, this.sesionSeleccionada()?.token).subscribe({
      next: resultado => { this.procesando.set(null); this.abrirEdicionSolicitud(solicitud, resultado.faltantes); },
      error: () => { this.procesando.set(null); this.abrirEdicionSolicitud(solicitud, []); },
    });
  }

  private abrirEdicionSolicitud(solicitud: SolicitudPreorden, faltantes: { nombre: string }[]): void {
    this.solicitudesAbiertas.set(false);
    this.router.navigate(['/preordenes/nueva'], { queryParams: { edit: 'true', orderId: solicitud.id, solicitudCliente: 'true', solicitudEstado: solicitud.estado, faltantes: faltantes.map(item => item.nombre).join('|') } });
  }

  private confirmarReactivacion(solicitud: SolicitudPreorden): void {
    this.procesando.set(`reactivar-solicitud-${solicitud.id}`);
    this.servicio.reactivarSolicitud(solicitud.id, this.sesionSeleccionada()?.token).subscribe({
      next: () => { this.procesando.set(null); this.toastr.success('Solicitud reactivada. El stock quedó reservado por 20 minutos.'); this.cargarSolicitudes(); },
      error: e => { this.procesando.set(null); this.toastr.error(e?.error?.message || 'No se pudo reactivar la solicitud.'); }
    });
  }

  cerrarPreordenes(): void {
    this.preordenesAbiertas.set(false);
    this.consultaPreorden.set('');
  }

  activarPreorden(ficha: ServicioFicha): void {
    if (!this.sesionSeleccionada()) { this.toastr.warning('Selecciona una sesión de Mesero.'); return; }
    this.procesando.set(`activar-preorden-${ficha.id}`);
    this.servicio.activarPreorden(ficha.id, this.sesionSeleccionada()?.token).subscribe({
      next: () => {
        this.preordenesProgramadas.update(preordenes => preordenes.filter(item => item.id !== ficha.id));
        this.procesando.set(null);
        this.toastr.success(`Preorden #${ficha.numero_orden} activada.`);
        this.cargar(false);
      },
      error: error => {
        this.procesando.set(null);
        this.toastr.error(error?.error?.message || 'No se pudo activar la preorden.');
        this.cargar(false);
      },
    });
  }

  buscarOrdenes(): void {
    const q = this.consultaOrden().trim();
    if (q.length < 1) { this.resultadosOrden.set([]); this.procesando.set(null); return; }
    const secuencia = ++this.busquedaOrdenSecuencia;
    this.procesando.set('buscar-orden');
    this.servicio.buscarOrdenes(q, this.sesionSeleccionada()?.token).subscribe({
      next: response => { if (secuencia !== this.busquedaOrdenSecuencia) return; this.resultadosOrden.set(response.ordenes ?? []); this.procesando.set(null); },
      error: error => { if (secuencia !== this.busquedaOrdenSecuencia) return; this.procesando.set(null); this.toastr.error(error?.error?.message || 'No se pudieron buscar órdenes.'); },
    });
  }

  actualizarConsultaOrden(valor: string): void {
    this.consultaOrden.set(valor);
    this.consultaOrdenCambios.next(valor.trim());
  }

  seleccionarOrden(orden: OrdenServicioResumen): void {
    this.procesando.set('cargar-orden');
    this.servicio.obtenerOrden(orden.id, this.sesionSeleccionada()?.token).subscribe({
      next: response => { this.ordenSeleccionada.set(response.orden); this.procesando.set(null); },
      error: error => { this.procesando.set(null); this.toastr.error(error?.error?.message || 'No se pudo abrir la orden.'); },
    });
  }

  abrirSelectorProducto(): void {
    this.selectorProductoAbierto.set(true);
    this.productoSeleccionado.set(null);
    this.busquedaProducto.set('');
    this.servicio.listarProductos(this.sesionSeleccionada()?.token).subscribe({
      next: response => this.productos.set((response.productos ?? []).filter(producto => producto.activo)),
      error: error => this.toastr.error(error?.error?.message || 'No se pudieron cargar los productos.'),
    });
  }

  seleccionarProducto(producto: Producto): void {
    if (!this.productoDisponible(producto)) return;
    this.productoSeleccionado.set(producto);
    this.cantidadAdicional.set(1);
    this.notaAdicional.set('');
    this.opcionesSeleccionadas.set((producto.modificadores ?? []).flatMap(grupo =>
      (grupo.opciones ?? []).filter(opcion => opcion.predeterminado).map(opcion => opcion.id)));
  }

  actualizarBusquedaProducto(valor: string): void {
    this.busquedaProducto.set(valor);
    if (this.temporizadorBusquedaProducto) clearTimeout(this.temporizadorBusquedaProducto);
    const consulta = valor.trim().toLocaleLowerCase();
    if (!consulta) return;
    this.temporizadorBusquedaProducto = setTimeout(() => {
      if (this.busquedaProducto().trim().toLocaleLowerCase() !== consulta) return;
      const coincidencias = this.productosFiltrados().filter(producto => this.productoDisponible(producto));
      if (coincidencias.length === 1) this.seleccionarProducto(coincidencias[0]);
    }, 350);
  }

  productoDisponible(producto: Producto): boolean {
    const stock = producto.stock_disponible ?? producto.stock;
    return producto.activo && (!producto.maneja_stock || stock == null || stock > 0);
  }

  textoStockProducto(producto: Producto): string {
    if (!producto.maneja_stock) return 'Disponible';
    const stock = producto.stock_disponible ?? producto.stock ?? 0;
    return stock > 0 ? `${stock} disponibles` : 'Sin stock';
  }

  toggleOpcion(grupo: ModificadorEstructurado, opcion: ModificadorOpcion): void {
    const actuales = this.opcionesSeleccionadas();
    if (actuales.includes(opcion.id)) {
      this.opcionesSeleccionadas.set(actuales.filter(id => id !== opcion.id));
      return;
    }
    const idsGrupo = new Set((grupo.opciones ?? []).map(item => item.id));
    this.opcionesSeleccionadas.set(grupo.tipo === 'unico'
      ? [...actuales.filter(id => !idsGrupo.has(id)), opcion.id]
      : [...actuales, opcion.id]);
  }

  opcionSeleccionada(id: number): boolean { return this.opcionesSeleccionadas().includes(id); }
  disminuirCantidadAdicional(): void { this.cantidadAdicional.set(Math.max(1, this.cantidadAdicional() - 1)); }
  aumentarCantidadAdicional(): void { this.cantidadAdicional.set(Math.min(20, this.cantidadAdicional() + 1)); }

  agregarAdicional(): void {
    const orden = this.ordenSeleccionada();
    const producto = this.productoSeleccionado();
    if (!orden || !producto) return;
    if (!producto.activo) { this.toastr.warning(producto.nombre + ' está desactivado. Selecciona otro producto.'); return; }
    this.procesando.set('agregar-adicional');
    this.servicio.agregarAdicional(orden.id, {
      producto_id: producto.id,
      cantidad: this.cantidadAdicional(),
      nota: this.notaAdicional().trim() || null,
      modificador_opcion_ids: this.opcionesSeleccionadas(),
    }, this.sesionSeleccionada()?.token).subscribe({
      next: response => {
        this.ordenSeleccionada.set(response.orden);
        this.selectorProductoAbierto.set(false);
        this.productoSeleccionado.set(null);
        this.procesando.set(null);
        this.viendoEntregadas.set(false);
        this.toastr.success('Producto agregado a la orden.');
        this.cargar(false);
      },
      error: error => { this.procesando.set(null); this.toastr.error(error?.error?.message || 'No se pudo agregar el producto.'); },
    });
  }

  cargar(mostrarCarga = true): void {
    if (this.cerrandoSesion || (!this.sesionSeleccionada() && this.esAccesoPrincipal())) return;
    if (mostrarCarga) this.loading.set(true);
    const sesion = this.sesionSeleccionada();
    this.cargaSub?.unsubscribe();
    this.cargaSub = this.servicio.listar(sesion?.token, this.fechaTablero()).subscribe({
      next: tablero => {
        this.todasFichas.set(tablero.todas_fichas ?? []);
        this.disponibles.set(this.ordenarPorLlegada(tablero.disponibles ?? []));
        this.misFichas.set(tablero.mis_fichas ?? []);
        this.misEntregadas.set(tablero.mis_entregadas ?? []);
        this.preordenesProgramadas.set(tablero.preordenes_programadas ?? []);
        const sesionActual = this.sesionSeleccionada();
        if (sesionActual) this.guardarTableroSesion(sesionActual);
        this.loading.set(false);
      },
      error: error => {
        this.loading.set(false);
        if (error.status === 401 && sesion) {
          if (this.sesiones401Notificadas.has(sesion.session_id)) return;
          this.sesiones401Notificadas.add(sesion.session_id);
          this.quitarSesionLocal(sesion.session_id);
          this.toastr.warning('La sesión de Servicio expiró. Ingresa nuevamente.');
          if (sesion.principal) {
            this.detenerActividadAutomatica();
            this.limpiarTablero();
            this.auth.marcarCierreServicioCelular();
            this.router.navigateByUrl('/login', { replaceUrl: true });
          } else {
            this.cargar(false);
          }
          return;
        }
        this.toastr.error(error?.error?.message || 'No se pudo actualizar Servicio.');
      }
    });
  }

  seleccionarSesion(sesion: ServicioSesion): void {
    const anterior = this.sesionSeleccionada();
    if (anterior?.session_id === sesion.session_id) return;
    if (anterior) this.guardarTableroSesion(anterior);
    this.sesiones401Notificadas.delete(sesion.session_id);
    this.sesionSeleccionada.set(sesion);
    const cache = this.tableroPorSesion.get(this.claveTableroSesion(sesion));
    this.misFichas.set(cache?.mis_fichas ?? []);
    this.misEntregadas.set(cache?.mis_entregadas ?? []);
    this.loading.set(false);
    this.cargar(false);
  }

  cambiarFechaTablero(value: string): void {
    if (!value) return;
    this.fechaTablero.set(value);
    this.cargar();
  }

  volverAHoy(): void {
    const hoy = this.fechaHoy;
    if (this.fechaTablero() === hoy) return;
    this.fechaTablero.set(hoy);
    this.cargar();
  }

  abrirIngreso(): void {
    if (!this.permiteSesionesPin()) return;
    this.mostrarIngreso.set(true);
    this.meseroSeleccionado.set(null);
    this.pin.reset();
    this.errorIngreso.set(null);
    if (this.meseros().length) return;
    this.auth.listarMeserosAccesoRapido().subscribe({
      next: response => this.meseros.set(response.meseros ?? []),
      error: () => this.errorIngreso.set('No se pudo cargar la lista de meseros.')
    });
  }

  elegirMesero(mesero: Mesero): void {
    if (this.sesiones().some(sesion => sesion.user.id === mesero.id)) {
      this.toastr.info(`${mesero.name} ya tiene una sesión activa en este dispositivo.`);
      return;
    }
    this.meseroSeleccionado.set(mesero);
    this.pin.reset();
    this.errorIngreso.set(null);
  }

  ingresar(): void {
    const mesero = this.meseroSeleccionado();
    if (!mesero || this.pin.invalid || this.procesando() === 'ingreso') {
      this.pin.markAsTouched();
      return;
    }
    this.procesando.set('ingreso');
    this.auth.loginConPin(mesero.id, this.pin.value).subscribe({
      next: response => {
        const sesion: ServicioSesion = {
          session_id: response.session_id,
          token: response.token,
          expires_at: Date.now() + response.expires_in * 1000,
          user: { id: response.user.id, name: response.user.name }
        };
        this.sesiones.set(this.servicio.agregarSesion(sesion));
        this.sesionSeleccionada.set(sesion);
        this.sesiones401Notificadas.delete(sesion.session_id);
        this.mostrarIngreso.set(false);
        this.procesando.set(null);
        this.pin.reset();
        this.cargar(false);
      },
      error: error => {
        this.errorIngreso.set(error?.error?.message || 'PIN incorrecto.');
        this.procesando.set(null);
        this.pin.reset();
      }
    });
  }

  tomar(ficha: ServicioFicha): void {
    const sesion = this.requerirSesion();
    if (!sesion || this.procesando() === `tomar-${ficha.id}`) return;
    const indiceOriginal = this.disponibles().findIndex(item => item.id === ficha.id);
    this.registrarActualizacionLocal(ficha.id);
    this.disponibles.update(fichas => fichas.filter(item => item.id !== ficha.id));
    this.misFichas.update(fichas => fichas.some(item => item.id === ficha.id)
      ? fichas
      : [...fichas, { ...ficha, mesero: sesion.user.name, mesero_id: sesion.user.id }]);
    this.procesando.set(`tomar-${ficha.id}`);
    this.servicio.tomar(ficha.id, sesion.token).subscribe({
      next: () => { this.procesando.set(null); this.cargar(false); },
      error: error => {
        this.descartarActualizacionLocal(ficha.id);
        this.misFichas.update(fichas => fichas.filter(item => item.id !== ficha.id));
        this.disponibles.update(fichas => {
          if (fichas.some(item => item.id === ficha.id)) return fichas;
          const restauradas = [...fichas];
          restauradas.splice(Math.max(0, indiceOriginal), 0, ficha);
          return restauradas;
        });
        this.procesando.set(null);
        this.toastr.warning(error?.error?.message || 'La ficha ya fue tomada.');
        this.cargar(false);
      }
    });
  }

  confirmar(detalleId: number): void {
    const sesion = this.requerirSesion();
    if (!sesion || this.confirmacionesPendientes().has(detalleId)) return;
    const ficha = [...this.misFichas(), ...this.todasFichas()].find(item => item.detalles.some(detalle => detalle.id === detalleId));
    const detalle = ficha?.detalles.find(item => item.id === detalleId);
    if (!ficha || !detalle || detalle.servido || ficha.estado === 'entregado') return;
    const estadoAnterior = { listo: detalle.listo, servido: detalle.servido };
    this.registrarActualizacionLocal(ficha.id);
    this.actualizarDetalleLocal(detalleId, true, true);
    this.marcarConfirmacionPendiente(detalleId, true);
    this.servicio.confirmar(detalleId, sesion.token).subscribe({
      next: () => {
        this.marcarConfirmacionPendiente(detalleId, false);
        const sesionActual = this.sesionSeleccionada();
        if (sesionActual) this.guardarTableroSesion(sesionActual);
      },
      error: error => {
        this.descartarActualizacionLocal(ficha.id);
        this.actualizarDetalleLocal(detalleId, estadoAnterior.listo, estadoAnterior.servido);
        this.marcarConfirmacionPendiente(detalleId, false);
        this.toastr.warning(error?.error?.message || 'No se pudo confirmar el producto.');
        this.cargar(false);
      }
    });
  }

  private marcarConfirmacionPendiente(detalleId: number, pendiente: boolean): void {
    this.confirmacionesPendientes.update(actuales => {
      const siguientes = new Set(actuales);
      if (pendiente) siguientes.add(detalleId);
      else siguientes.delete(detalleId);
      return siguientes;
    });
  }

  abrirUbicacion(ficha: ServicioFicha): void {
    this.fichaUbicacion.set(ficha);
    this.editandoUbicacion.set(false);
    this.eliminandoFotoUbicacion.set(false);
  }

  editarUbicacion(): void {
    const ubicacion = this.fichaUbicacion()?.ubicacion_entrega;
    this.ubicacionForm.reset({
      direccion: ubicacion?.direccion ?? '',
      referencia_ubicacion: ubicacion?.referencia ?? '',
      latitud: ubicacion?.latitud ?? null,
      longitud: ubicacion?.longitud ?? null,
      foto_local: null,
    });
    this.eliminandoFotoUbicacion.set(false);
    this.editandoUbicacion.set(true);
  }

  actualizarPuntoEntrega(ubicacion: MapLocation): void { this.ubicacionForm.patchValue(ubicacion); }

  guardarUbicacion(): void {
    const ficha = this.fichaUbicacion();
    if (!ficha?.cliente_id || this.procesando() === 'guardar-ubicacion') return;
    const data = new FormData();
    const valores = this.ubicacionForm.value;
    data.append('direccion', valores.direccion ?? '');
    data.append('referencia_ubicacion', valores.referencia_ubicacion ?? '');
    if (valores.latitud != null) data.append('latitud', String(valores.latitud));
    if (valores.longitud != null) data.append('longitud', String(valores.longitud));
    if (valores.foto_local instanceof File) data.append('foto_local', valores.foto_local);
    if (this.eliminandoFotoUbicacion()) data.append('eliminar_foto', '1');
    this.procesando.set('guardar-ubicacion');
    this.servicio.actualizarUbicacionCliente(ficha.cliente_id, data, this.sesionSeleccionada()?.token).subscribe({
      next: response => {
        const actualizar = (items: ServicioFicha[]) => items.map(item => item.cliente_id === ficha.cliente_id
          ? { ...item, ubicacion_entrega: response.ubicacion_entrega }
          : item);
        this.misFichas.update(actualizar);
        this.todasFichas.update(actualizar);
        this.disponibles.update(actualizar);
        this.fichaUbicacion.update(item => item ? { ...item, ubicacion_entrega: response.ubicacion_entrega } : null);
        this.procesando.set(null);
        this.editandoUbicacion.set(false);
        this.toastr.success('Ubicación actualizada.');
      },
      error: error => {
        this.procesando.set(null);
        this.toastr.error(error?.error?.message || 'No se pudo guardar la ubicación.');
      },
    });
  }

  indicacionesUrl(ficha: ServicioFicha): string | null {
    const ubicacion = ficha.ubicacion_entrega;
    if (ubicacion?.latitud == null || ubicacion.longitud == null) return null;
    const destino = encodeURIComponent(`${ubicacion.latitud},${ubicacion.longitud}`);
    const origen = this.configuracion.ubicacionRestaurante();
    if (!origen) return `https://www.google.com/maps/search/?api=1&query=${destino}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${origen.latitud},${origen.longitud}`)}&destination=${destino}&travelmode=walking`;
  }

  agruparDetalles(ficha: ServicioFicha): GrupoDetalleServicio[] {
    return this.agruparListaDetalles(ficha.detalles, true);
  }

  agruparDetallesOrden(detalles: ServicioFicha['detalles']): GrupoDetalleServicio[] {
    return this.agruparListaDetalles(detalles, false);
  }

  private agruparListaDetalles(detalles: ServicioFicha['detalles'], separarPorEstado: boolean): GrupoDetalleServicio[] {
    const grupos = new Map<string, GrupoDetalleServicio>();
    detalles.forEach(detalle => {
      const opciones = [...(detalle.opciones || [])].sort((a, b) => a.localeCompare(b));
      const nota = detalle.nota?.trim() || null;
      const precioUnitario = Number(detalle.precio_unitario ?? 0);
      const categoria = detalle.categoria?.trim() || 'Sin categoría';
      const clave = JSON.stringify([categoria, detalle.producto.trim().toLocaleLowerCase(), precioUnitario.toFixed(2), opciones.map(opcion => opcion.toLocaleLowerCase()), nota?.toLocaleLowerCase() || '', separarPorEstado ? detalle.listo : null, separarPorEstado ? detalle.llevando_por_id : null, separarPorEstado ? detalle.servido : null, separarPorEstado ? detalle.entregado_por : null]);
      const grupo = grupos.get(clave) || {
        clave,
        categoria,
        cantidad: 0,
        producto: detalle.producto,
        precioUnitario,
        opciones,
        nota,
        listo: detalle.listo,
        detalles: [],
      };
      grupo.cantidad += Number(detalle.cantidad || 1);
      grupo.detalles.push(detalle);
      grupos.set(clave, grupo);
    });
    const ordenados = [...grupos.values()].sort((a, b) => a.categoria.localeCompare(b.categoria, 'es'));
    return ordenados.map((grupo, indice) => ({ ...grupo, inicioCategoria: indice === 0 || ordenados[indice - 1].categoria !== grupo.categoria }));
  }

  abrirTodas(): void {
    this.viendoTodas.set(true);
    this.cargar(false);
  }

  colaborar(detalleId: number, accion: 'llevar' | 'cancelar' | 'entregar'): void {
    const sesion = this.requerirSesion();
    if (!sesion || this.procesando()) return;
    this.procesando.set('colaborar-' + detalleId);
    this.servicio.colaborar(detalleId, accion, sesion.token).subscribe({
      next: () => { this.procesando.set(null); this.cargar(false); },
      error: error => { this.procesando.set(null); this.toastr.warning(error?.error?.message || 'No se pudo registrar la entrega.'); this.cargar(false); },
    });
  }

  estadoFicha(ficha: ServicioFicha): string {
    return ({ pendiente: 'Pendiente', preparando: 'En preparación', listo: 'Listo', entregado: 'Entregado', cancelado: 'Cancelado' } as Record<string, string>)[ficha.estado ?? ''] ?? 'En atención';
  }

  tieneProductosEnCamino(ficha: ServicioFicha): boolean {
    return ficha.detalles.some(detalle => !!detalle.llevando_por_id);
  }

  formatearPrecio(precio: number | string): string {
    return formatCurrency(precio);
  }

  formatearEspera(minutos: number): string {
    const total = Math.max(0, Math.floor(Number(minutos) || 0));
    if (total < 60) return `${total}m`;
    const horas = Math.floor(total / 60);
    const restantes = total % 60;
    return restantes ? `${horas}h ${restantes}m` : `${horas}h`;
  }

  entregar(ficha: ServicioFicha): void {
    const sesion = this.requerirSesion();
    if (!sesion || !ficha.todo_listo || this.procesando() === `entregar-${ficha.id}`) return;
    const indiceOriginal = this.misFichas().findIndex(item => item.id === ficha.id);
    const entregada: ServicioFicha = { ...ficha, entregada_en: new Date().toISOString() };
    this.registrarActualizacionLocal(ficha.id);
    this.misFichas.update(fichas => fichas.filter(item => item.id !== ficha.id));
    this.misEntregadas.update(fichas => fichas.some(item => item.id === ficha.id) ? fichas : [entregada, ...fichas]);
    this.procesando.set(`entregar-${ficha.id}`);
    this.servicio.entregar(ficha.id, sesion.token).subscribe({
      next: () => { this.procesando.set(null); this.toastr.success(`Ficha #${ficha.numero_orden} entregada.`); this.cargar(false); },
      error: error => {
        this.descartarActualizacionLocal(ficha.id);
        this.misEntregadas.update(fichas => fichas.filter(item => item.id !== ficha.id));
        this.misFichas.update(fichas => {
          if (fichas.some(item => item.id === ficha.id)) return fichas;
          const restauradas = [...fichas];
          restauradas.splice(Math.max(0, indiceOriginal), 0, ficha);
          return restauradas;
        });
        this.procesando.set(null);
        this.toastr.error(error?.error?.message || 'No se pudo entregar la ficha.');
      }
    });
  }

  solicitarLiberacion(ficha: ServicioFicha): void { this.fichaALiberar.set(ficha); }

  confirmarLiberacion(): void {
    const ficha = this.fichaALiberar();
    const sesion = this.requerirSesion();
    if (!ficha || !sesion || this.procesando() === `liberar-${ficha.id}`) return;
    const indiceOriginal = this.misFichas().findIndex(item => item.id === ficha.id);
    this.registrarActualizacionLocal(ficha.id);
    this.misFichas.update(fichas => fichas.filter(item => item.id !== ficha.id));
    this.disponibles.update(fichas => fichas.some(item => item.id === ficha.id)
      ? this.ordenarPorLlegada(fichas)
      : this.ordenarPorLlegada([...fichas, { ...ficha, mesero: null }]));
    this.fichaALiberar.set(null);
    this.procesando.set(`liberar-${ficha.id}`);
    this.servicio.liberar(ficha.id, sesion.token).subscribe({
      next: () => {
        this.procesando.set(null);
        this.toastr.success(`Ficha #${ficha.numero_orden} liberada.`);
      },
      error: error => {
        this.descartarActualizacionLocal(ficha.id);
        this.disponibles.update(fichas => fichas.filter(item => item.id !== ficha.id));
        this.misFichas.update(fichas => {
          if (fichas.some(item => item.id === ficha.id)) return fichas;
          const restauradas = [...fichas];
          restauradas.splice(Math.max(0, indiceOriginal), 0, ficha);
          return restauradas;
        });
        this.procesando.set(null);
        this.toastr.error(error?.error?.message || 'No se pudo liberar la ficha.');
      }
    });
  }

  cerrarMiSesion(): void {
    const sesion = this.sesionSeleccionada();
    if (!sesion || this.procesando() === 'cerrar') return;
    if (this.misFichas().length > 0) {
      this.confirmarCierre.set(true);
      return;
    }
    this.ejecutarCierre(false);
  }

  cerrarYLiberar(): void {
    this.confirmarCierre.set(false);
    this.ejecutarCierre(true);
  }

  etiquetaTipo(ficha: ServicioFicha): string {
    return ficha.tipo_orden === 'dine-in' ? 'En mesa' : ficha.tipo_orden === 'delivery' ? 'Delivery' : 'Para llevar';
  }

  private ejecutarCierre(liberarFichas: boolean): void {
    const sesion = this.sesionSeleccionada();
    if (!sesion) return;
    this.cerrandoSesion = true;
    this.detenerActividadAutomatica();
    this.procesando.set('cerrar');
    this.servicio.cerrarSesion(sesion.token, liberarFichas).subscribe({
      next: () => this.finalizarCierre(sesion.session_id),
      error: error => {
        this.cerrandoSesion = false;
        this.activarTiempoReal();
        this.procesando.set(null);
        if (error.status === 409 && error?.error?.requiere_confirmacion) {
          this.confirmarCierre.set(true);
          this.cargar(false);
          return;
        }
        this.toastr.error(error?.error?.message || 'No se pudo cerrar la sesión.');
      }
    });
  }

  cerrarIngreso(): void { this.mostrarIngreso.set(false); this.pin.reset(); }

  private finalizarCierre(sessionId: string): void {
    if (this.sesionSeleccionada()?.principal) {
      this.sesiones.set([]);
      this.sesionSeleccionada.set(null);
      this.limpiarTablero();
      this.cerrandoSesion = false;
      this.procesando.set(null);
      this.auth.marcarCierreServicioCelular();
      this.router.navigateByUrl('/login', { replaceUrl: true });
      return;
    }
    this.quitarSesionLocal(sessionId);
    this.cerrandoSesion = false;
    this.procesando.set(null);
    this.activarTiempoReal();
    this.cargar(false);
  }

  private quitarSesionLocal(sessionId: string): void {
    if (this.sesionSeleccionada()?.principal && this.sesionSeleccionada()?.session_id === sessionId) {
      this.sesiones.set([]);
      this.sesionSeleccionada.set(null);
      this.misFichas.set([]);
      this.misEntregadas.set([]);
      return;
    }
    const sesiones = this.servicio.quitarSesion(sessionId);
    this.sesiones.set(sesiones);
    if (this.sesionSeleccionada()?.session_id === sessionId) {
      this.sesionSeleccionada.set(sesiones[0] ?? null);
      this.misFichas.set([]);
      this.misEntregadas.set([]);
    }
  }

  private requerirSesion(): ServicioSesion | null {
    const sesion = this.sesionSeleccionada();
    if (!sesion) {
      this.abrirIngreso();
      this.toastr.info('Ingresa como mesero para continuar.');
    }
    return sesion;
  }

  iniciarSesionPrincipal(): void {
    if (!this.sesionPrincipal) return;
    this.sesiones401Notificadas.delete(this.sesionPrincipal.session_id);
    this.sesiones.set([this.sesionPrincipal]);
    this.sesionSeleccionada.set(this.sesionPrincipal);
    this.activarTiempoReal();
    this.cargar();
  }

  private activarTiempoReal(): void {
    if (this.subs.length) return;
    this.subs.push(
      this.reverb.escucharCanal('canal-inventario', '.ProductoActualizado').subscribe((evento: { producto?: Partial<Producto> & Pick<Producto, 'id' | 'precio' | 'activo'> }) => {
        const producto = evento.producto;
        if (!producto) return;
        const seleccionado = this.productoSeleccionado();
        if (seleccionado?.id === producto.id) {
          if (Number(seleccionado.precio) !== Number(producto.precio)) this.toastr.info(seleccionado.nombre + ': el precio cambió a ' + this.formatearPrecio(producto.precio) + '.');
          if (seleccionado.activo !== producto.activo) this.toastr.warning(seleccionado.nombre + (producto.activo ? ' volvió a estar activo.' : ' fue desactivado. Selecciona otro producto.'));
          this.productoSeleccionado.set({ ...seleccionado, ...producto });
        }
        this.productos.update(items => items.map(item => item.id === producto.id ? { ...item, ...producto } : item));
        if (this.selectorProductoAbierto() && !this.productos().some(item => item.id === producto.id) && producto.activo) {
          this.servicio.listarProductos(this.sesionSeleccionada()?.token).subscribe({ next: response => this.productos.set(response.productos ?? []) });
        }
      }),
      this.reverb.escucharCanal('canal-ordenes', '.OrdenCreada').subscribe(() => this.cargar(false)),
      this.reverb.escucharCanal('canal-ordenes', '.ServicioFichaActualizada').subscribe((evento: { orden_id?: number; accion?: string; mesero_id?: number | null; ficha?: ServicioFicha | null; actividad?: { user_id: number; mensaje: string } | null }) => {
        const ordenId = Number(evento.orden_id || 0);
        if (!ordenId) return;
        const sesion = this.sesionSeleccionada();
        if (evento.actividad && sesion && sesion.user.id === evento.mesero_id && evento.actividad.user_id !== sesion.user.id) {
          this.toastr.info(evento.actividad.mensaje);
        }
        if (this.consumirActualizacionLocal(ordenId)) return;
        if (this.viendoTodas() || evento.accion === 'colaboracion' || evento.accion === 'adicional') { this.cargar(false); return; }

        if (evento.accion === 'tomada') {
          this.disponibles.update(fichas => fichas.filter(ficha => ficha.id !== ordenId));
          return;
        }
        if (evento.accion === 'entregada') {
          this.disponibles.update(fichas => fichas.filter(ficha => ficha.id !== ordenId));
          this.misFichas.update(fichas => fichas.filter(ficha => ficha.id !== ordenId));
          return;
        }
        if (evento.accion === 'liberada' && evento.ficha) {
          this.misFichas.update(fichas => fichas.filter(ficha => ficha.id !== ordenId));
          this.disponibles.update(fichas => this.ordenarPorLlegada(
            fichas.some(ficha => ficha.id === ordenId) ? fichas : [...fichas, evento.ficha!]
          ));
          return;
        }
        // Los cambios de productos listos actualizan contadores y bordes del tablero.
        // También sirve de respaldo si una versión antigua del servidor no envía la ficha.
        this.cargar(false);
      }),
      this.reverb.escucharCanal('canal-ordenes', '.OrdenCocinaActualizada').subscribe((evento: { orden_id?: number; origen?: string | null }) => {
        // Los cambios de Servicio llegan por el evento liviano anterior. Evita una
        // segunda descarga completa del tablero en cada toma de ficha.
        if (evento.origen === 'servicio') return;
        this.cargar(false);
      }),
      this.reverb.escucharCanal('canal-ordenes', '.PreordenActualizada').subscribe((evento: { tipo?: string }) => {
        this.cargar(false);
        if (evento.tipo?.startsWith('solicitud_')) {
          this.cargarSolicitudes();
          if (evento.tipo === 'solicitud_creada') {
            this.reproducirAvisoSolicitud();
            this.toastr.info('Nueva solicitud de preorden. Revísala antes de que venza la reserva de stock.');
          }
        }
      }),
      this.reverb.escucharCanal('canal-ordenes', '.ServicioSesionActualizada').subscribe(evento => {
        if (this.cerrandoSesion) return;
        if (evento?.tipo === 'sesion_cerrada' && evento?.session_id) this.quitarSesionLocal(evento.session_id);
        this.cargar(false);
      })
    );
  }

  private reproducirAvisoSolicitud(): void {
    if (!this.avisosSonorosHabilitados || this.contextoAvisos?.state !== 'running') return;
    try {
      const contexto = this.contextoAvisos;
      const inicio = contexto.currentTime;
      [659, 880, 1046].forEach((frecuencia, indice) => {
        const cuando = inicio + indice * .14;
        const tono = contexto.createOscillator();
        const volumen = contexto.createGain();
        tono.type = 'sine'; tono.frequency.value = frecuencia;
        volumen.gain.setValueAtTime(.0001, cuando);
        volumen.gain.exponentialRampToValueAtTime(.12, cuando + .02);
        volumen.gain.exponentialRampToValueAtTime(.0001, cuando + .12);
        tono.connect(volumen).connect(contexto.destination);
        tono.start(cuando); tono.stop(cuando + .13);
      });
    } catch { /* El aviso visual sigue disponible. */ }
  }

  private registrarActualizacionLocal(ordenId: number): void {
    const cantidad = this.actualizacionesLocales.get(ordenId)?.cantidad ?? 0;
    this.actualizacionesLocales.set(ordenId, { cantidad: cantidad + 1, fecha: Date.now() });
  }

  private actualizarDetalleLocal(detalleId: number, listo: boolean, servido?: boolean): void {
    const actualizarFichas = (fichas: ServicioFicha[]): ServicioFicha[] => fichas.map(ficha => {
      if (!ficha.detalles.some(detalle => detalle.id === detalleId)) return ficha;
      const detalles = ficha.detalles.map(detalle => detalle.id === detalleId
        ? { ...detalle, listo, servido }
        : detalle);
      const listos = detalles.filter(detalle => detalle.listo).length;
      return {
        ...ficha,
        detalles,
        listos,
        todo_listo: detalles.length > 0 && detalles.every(detalle => detalle.listo),
      };
    });
    this.misFichas.update(actualizarFichas);
    this.todasFichas.update(actualizarFichas);
    this.disponibles.update(actualizarFichas);
  }

  private consumirActualizacionLocal(ordenId: number): boolean {
    const actualizacion = this.actualizacionesLocales.get(ordenId);
    if (!actualizacion || Date.now() - actualizacion.fecha >= 10000) {
      if (actualizacion) this.actualizacionesLocales.delete(ordenId);
      return false;
    }
    if (actualizacion.cantidad <= 1) this.actualizacionesLocales.delete(ordenId);
    else this.actualizacionesLocales.set(ordenId, { ...actualizacion, cantidad: actualizacion.cantidad - 1 });
    return true;
  }

  private descartarActualizacionLocal(ordenId: number): void {
    const actualizacion = this.actualizacionesLocales.get(ordenId);
    if (!actualizacion || actualizacion.cantidad <= 1) this.actualizacionesLocales.delete(ordenId);
    else this.actualizacionesLocales.set(ordenId, { ...actualizacion, cantidad: actualizacion.cantidad - 1 });
  }

  private ordenarPorLlegada(fichas: ServicioFicha[]): ServicioFicha[] {
    return [...fichas].sort((a, b) => {
      const prioridadA = a.tipo_flujo === 'preorden' && a.estado_preorden === 'activada' ? 0 : 1;
      const prioridadB = b.tipo_flujo === 'preorden' && b.estado_preorden === 'activada' ? 0 : 1;
      if (prioridadA !== prioridadB) return prioridadA - prioridadB;
      const fechaA = new Date(a.created_at).getTime();
      const fechaB = new Date(b.created_at).getTime();
      if (Number.isFinite(fechaA) && Number.isFinite(fechaB) && fechaA !== fechaB) return fechaA - fechaB;
      return a.id - b.id;
    });
  }

  private claveTableroSesion(sesion: ServicioSesion): string {
    return `${sesion.session_id}:${this.fechaTablero()}`;
  }

  private guardarTableroSesion(sesion: ServicioSesion): void {
    this.tableroPorSesion.set(this.claveTableroSesion(sesion), {
      mis_fichas: this.misFichas(),
      mis_entregadas: this.misEntregadas(),
    });
  }

  private detenerActividadAutomatica(): void {
    this.cargaSub?.unsubscribe();
    this.cargaSub = undefined;
    this.subs.forEach(sub => sub.unsubscribe());
    this.subs = [];
  }

  private limpiarTablero(): void {
    this.todasFichas.set([]);
    this.disponibles.set([]);
    this.misFichas.set([]);
    this.misEntregadas.set([]);
    this.preordenesProgramadas.set([]);
    this.loading.set(false);
    this.confirmarCierre.set(false);
    this.fichaALiberar.set(null);
  }

  private fechaLocal(fecha: Date): string {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const día = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${día}`;
  }
}
