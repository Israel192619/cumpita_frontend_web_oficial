import { CommonModule } from '@angular/common';
import { Component, computed, OnDestroy, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../../../core/services/auth-service';
import { ReverbService } from '../../../../core/services/reverb-service';
import { OrdenServicioDetalle, OrdenServicioResumen, ServicioFicha, ServicioService, ServicioSesion } from '../../services/servicio-service';
import { Button } from '../../../../shared/components/button/button';
import { InputForm } from '../../../../shared/components/input-form/input-form';
import { Modal } from '../../../../shared/components/modal/modal';
import { ProductoService } from '../../../productos/services/producto-service';
import { Producto, ModificadorEstructurado, ModificadorOpcion } from '../../../../core/models/producto';
import { ProductGridComponent } from '../../../pos/components/product-grid/product-grid';

interface Mesero { id: number; name: string; }

@Component({
  selector: 'app-servicio-home',
  imports: [CommonModule, ReactiveFormsModule, Button, InputForm, Modal, ProductGridComponent],
  templateUrl: './servicio-home.html',
  styleUrls: ['./servicio-home.css', './servicio-theme.css']
})
export class ServicioHome implements OnInit, OnDestroy {
  sesiones = signal<ServicioSesion[]>([]);
  sesionSeleccionada = signal<ServicioSesion | null>(null);
  disponibles = signal<ServicioFicha[]>([]);
  misFichas = signal<ServicioFicha[]>([]);
  preordenesProgramadas = signal<ServicioFicha[]>([]);
  meseros = signal<Mesero[]>([]);
  meseroSeleccionado = signal<Mesero | null>(null);
  mostrarIngreso = signal(false);
  loading = signal(true);
  procesando = signal<string | null>(null);
  errorIngreso = signal<string | null>(null);
  confirmarCierre = signal(false);
  permiteSesionesPin = signal(false);
  esAccesoPrincipal = signal(false);
  fichaALiberar = signal<ServicioFicha | null>(null);
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
  productosFiltrados = computed(() => {
    const q = this.busquedaProducto().trim().toLowerCase();
    return this.productos().filter(producto => !q || `${producto.nombre} ${producto.descripcion ?? ''}`.toLowerCase().includes(q));
  });
  pin = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{4,6}$/)] });
  private subs: Subscription[] = [];
  private cargaSub?: Subscription;
  private sesionPrincipal?: ServicioSesion;
  private cerrandoSesion = false;
  private sesiones401Notificadas = new Set<string>();

  constructor(
    private servicio: ServicioService,
    private auth: AuthService,
    private reverb: ReverbService,
    private toastr: ToastrService,
    private router: Router,
    private productoService: ProductoService
  ) {}

  ngOnInit(): void {
    this.auth.me().subscribe({
      next: usuario => {
        const rol = (usuario.role?.nombre ?? '').trim().toLocaleLowerCase();
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
          this.permiteSesionesPin.set(true);
          this.sesiones.set(sesiones);
          this.sesionSeleccionada.set(sesiones[0] ?? null);
        }
        this.activarTiempoReal();
        this.cargar();
      },
      error: () => this.router.navigate(['/login'])
    });
  }

  ngOnDestroy(): void { this.detenerActividadAutomatica(); }

  abrirBuscadorOrden(): void {
    if (!this.sesionSeleccionada()) { this.toastr.warning('Selecciona una sesión de Mesero.'); return; }
    this.buscarOrdenAbierto.set(true);
    this.resultadosOrden.set([]);
    this.ordenSeleccionada.set(null);
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

  buscarOrdenes(): void {
    const q = this.consultaOrden().trim();
    if (q.length < 1) return;
    this.procesando.set('buscar-orden');
    this.servicio.buscarOrdenes(q, this.sesionSeleccionada()?.token).subscribe({
      next: response => { this.resultadosOrden.set(response.ordenes ?? []); this.procesando.set(null); },
      error: error => { this.procesando.set(null); this.toastr.error(error?.error?.message || 'No se pudieron buscar órdenes.'); },
    });
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
    this.productoService.listarProductos().subscribe({
      next: productos => this.productos.set(productos.filter(producto => producto.activo)),
      error: () => this.toastr.error('No se pudieron cargar los productos.'),
    });
  }

  seleccionarProducto(producto: Producto): void {
    this.productoSeleccionado.set(producto);
    this.cantidadAdicional.set(1);
    this.notaAdicional.set('');
    this.opcionesSeleccionadas.set((producto.modificadores ?? []).flatMap(grupo =>
      (grupo.opciones ?? []).filter(opcion => opcion.predeterminado).map(opcion => opcion.id)));
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
    this.cargaSub = this.servicio.listar(sesion?.token).subscribe({
      next: tablero => {
        this.disponibles.set(tablero.disponibles ?? []);
        this.misFichas.set(tablero.mis_fichas ?? []);
        this.preordenesProgramadas.set(tablero.preordenes_programadas ?? []);
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
    this.sesiones401Notificadas.delete(sesion.session_id);
    this.sesionSeleccionada.set(sesion);
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
    if (!sesion) return;
    this.procesando.set(`tomar-${ficha.id}`);
    this.servicio.tomar(ficha.id, sesion.token).subscribe({
      next: () => { this.procesando.set(null); this.cargar(false); },
      error: error => {
        this.procesando.set(null);
        this.toastr.warning(error?.error?.message || 'La ficha ya fue tomada.');
        this.cargar(false);
      }
    });
  }

  confirmar(detalleId: number): void {
    const sesion = this.requerirSesion();
    if (!sesion) return;
    this.procesando.set(`detalle-${detalleId}`);
    this.servicio.confirmar(detalleId, sesion.token).subscribe({
      next: () => { this.procesando.set(null); this.cargar(false); },
      error: error => { this.procesando.set(null); this.toastr.error(error?.error?.message || 'No se pudo confirmar el producto.'); }
    });
  }

  entregar(ficha: ServicioFicha): void {
    const sesion = this.requerirSesion();
    if (!sesion || !ficha.todo_listo) return;
    this.procesando.set(`entregar-${ficha.id}`);
    this.servicio.entregar(ficha.id, sesion.token).subscribe({
      next: () => { this.procesando.set(null); this.toastr.success(`Ficha #${ficha.numero_orden} entregada.`); this.cargar(false); },
      error: error => { this.procesando.set(null); this.toastr.error(error?.error?.message || 'No se pudo entregar la ficha.'); }
    });
  }

  solicitarLiberacion(ficha: ServicioFicha): void { this.fichaALiberar.set(ficha); }

  confirmarLiberacion(): void {
    const ficha = this.fichaALiberar();
    const sesion = this.requerirSesion();
    if (!ficha || !sesion) return;
    this.procesando.set(`liberar-${ficha.id}`);
    this.servicio.liberar(ficha.id, sesion.token).subscribe({
      next: () => {
        this.fichaALiberar.set(null);
        this.procesando.set(null);
        this.toastr.success(`Ficha #${ficha.numero_orden} liberada.`);
        this.cargar(false);
      },
      error: error => {
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
      return;
    }
    const sesiones = this.servicio.quitarSesion(sessionId);
    this.sesiones.set(sesiones);
    if (this.sesionSeleccionada()?.session_id === sessionId) {
      this.sesionSeleccionada.set(sesiones[0] ?? null);
      this.misFichas.set([]);
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
      this.reverb.escucharCanal('canal-ordenes', '.OrdenCreada').subscribe(() => this.cargar(false)),
      this.reverb.escucharCanal('canal-ordenes', '.OrdenCocinaActualizada').subscribe(() => this.cargar(false)),
      this.reverb.escucharCanal('canal-ordenes', '.PreordenActualizada').subscribe(() => this.cargar(false)),
      this.reverb.escucharCanal('canal-ordenes', '.ServicioSesionActualizada').subscribe(evento => {
        if (this.cerrandoSesion) return;
        if (evento?.tipo === 'sesion_cerrada' && evento?.session_id) this.quitarSesionLocal(evento.session_id);
        this.cargar(false);
      })
    );
  }

  private detenerActividadAutomatica(): void {
    this.cargaSub?.unsubscribe();
    this.cargaSub = undefined;
    this.subs.forEach(sub => sub.unsubscribe());
    this.subs = [];
  }

  private limpiarTablero(): void {
    this.disponibles.set([]);
    this.misFichas.set([]);
    this.preordenesProgramadas.set([]);
    this.loading.set(false);
    this.confirmarCierre.set(false);
    this.fichaALiberar.set(null);
  }
}
