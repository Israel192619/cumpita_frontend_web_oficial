import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ReverbService } from '@app/core/services/reverb-service';
import { AuthService } from '@app/core/services/auth-service';
import { User } from '@app/core/models/user';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { ActualizacionEstadoCocinaResponse, CocinaService, KdsCambioOrden, KdsDetalle, KdsOrden } from '../../services/cocina-service';
import { PuestosCocinaService, PuestoCocina } from '../../services/puestos-cocina';

@Component({
  selector: 'app-cocina-home',
  imports: [CommonModule],
  templateUrl: './cocina-home.html',
  styleUrl: './cocina-home.css',
})
export class CocinaHome implements OnInit, OnDestroy {
  ordenes = signal<KdsOrden[]>([]);
  categoriaSeleccionada = signal<string>('todos');
  fechaSeleccionada = signal<string>(this.fechaDeHoy());
  busqueda = signal<string>('');
  isLoading = signal<boolean>(true);
  detalleActualizando = signal<number | null>(null);
  puestos = signal<PuestoCocina[]>([]);
  puestosLoading = signal<boolean>(false);
  usuario = signal<User | null>(null);
  private subscriptions: Subscription[] = [];
  estacionId = signal<number | null>(null);
  selectedOrdenPorPuesto = signal<Record<number, number | null>>({});
  puestoModalAbierto = signal(false);

  puestoActual = computed(() => {
    const user = this.usuario();
    return this.puestos().find((puesto) => puesto.user_id === user?.id) ?? null;
  });

  puestosDisponibles = computed(() => this.puestos().filter((puesto) => puesto.user_id === null));

  bothPuestosOcupados = computed(() => this.puestos().length > 0 && this.puestos().every((puesto) => puesto.user_id !== null));

  ordenesParaAsignar = computed(() => {
    const ordenesAsignadas = new Set(this.puestos().map((puesto) => puesto.orden_id).filter((id): id is number => id !== null && id !== undefined));
    return this.ordenesVisibles().filter((orden) => !ordenesAsignadas.has(orden.id));
  });

  isCocinaCocinero = computed(() => {
    const user = this.usuario();
    return user?.estacion?.codigo === 'COCINA' && user?.role?.nombre === 'Cocinero';
  });

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
      .map((orden) => ({
        ...orden,
        detalles: orden.detalles.filter((detalle) => {
          const categoriaDetalle = detalle.producto.categoria?.nombre || 'Sin categoría';
          const coincideCategoria = categoria === 'todos' || categoriaDetalle === categoria;
          const contenido = `${orden.cliente?.nombre || ''} ${orden.numero_orden} ${detalle.producto.nombre}`.toLowerCase();
          return coincideCategoria && (!texto || contenido.includes(texto));
        }),
      }))
      .filter((orden) => orden.detalles.length > 0 || this.tieneCambiosRecientes(orden) || orden.estado === 'cancelado');
  });

  ordenEnServicio = computed(() => {
    return this.ordenes().find((orden) =>
      orden.detalles.some((detalle) => ['en_preparacion', 'listo_para_recoger'].includes(detalle.estado_cocina))
    ) ?? null;
  });

  constructor(
    private cocinaService: CocinaService,
    private puestosCocinaService: PuestosCocinaService,
    private reverb: ReverbService,
    private authService: AuthService,
    private toastr: ToastrService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.authService.me().subscribe({
      next: (user: User) => {
        console.log('Auth.me() ->', user);
        console.log('Auth.me() estacion_id (raw) ->', user.estacion_id, 'typeof', typeof user.estacion_id);
        this.usuario.set(user);
        this.estacionId.set(user.estacion_id ?? null);
        console.log('estacionId set to', this.estacionId(), 'typeof', typeof this.estacionId());
        this.cargarPedidos();
        if (user.estacion?.codigo === 'COCINA') {
          this.cargarPuestos();
        }
        this.escucharEventosReverb();
      },
      error: () => {
        this.estacionId.set(null);
        this.cargarPedidos();
        this.escucharEventosReverb();
      }
    });
    
  }

  abrirSeleccionPuesto(): void {
    this.puestoModalAbierto.set(true);
  }

  cerrarSeleccionPuesto(): void {
    this.puestoModalAbierto.set(false);
  }

  entrarAControl(): void {
    this.cerrarSeleccionPuesto();
    this.router.navigate(['/cocina/control']);
  }

  finalizarPuesto(): void {
    const puesto = this.puestoActual();
    if (!puesto) {
      return;
    }

    this.puestosCocinaService.liberarPuesto(puesto.id).subscribe({
      next: (respuesta) => {
        this.actualizarPuestoLocal(respuesta.puesto);
        this.cerrarSeleccionPuesto();
        this.toastr.success('Puesto finalizado.');
      },
      error: (err) => {
        this.toastr.error(err?.error?.message || 'No se pudo finalizar el puesto.');
      },
    });
  }

  abrirOPuesto(puesto: PuestoCocina): void {
    const user = this.usuario();

    if (!user) {
      this.toastr.error('Necesitas iniciar sesión para seleccionar un puesto.');
      return;
    }

    if (puesto.user_id === null) {
      this.puestosCocinaService.ocuparPuesto(puesto.id).subscribe({
        next: (respuesta) => {
          this.actualizarPuestoLocal(respuesta.puesto);
          this.cerrarSeleccionPuesto();
          this.router.navigate(['/cocina/control']);
        },
        error: (err) => {
          this.toastr.error(err?.error?.message || 'No se pudo ocupar el puesto.');
        },
      });
      return;
    }

    if (puesto.user_id !== user.id) {
      this.toastr.warning('El puesto ya está ocupado por otro usuario.');
      return;
    }

    this.cerrarSeleccionPuesto();
    this.router.navigate(['/cocina/puesto', puesto.id]);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  private escucharEventosReverb(): void {
    this.subscriptions.push(
      this.reverb.escucharCanal('canal-ordenes', '.OrdenCreada').subscribe((data: { orden?: KdsOrden }) => {
        if (data.orden) {
          this.insertarOActualizarOrden(data.orden);
        }
      }),
      this.reverb.escucharCanal('canal-ordenes', '.OrdenCocinaActualizada').subscribe((data: { orden?: KdsOrden; cambios?: KdsCambioOrden[] }) => {
        if (data.orden) {
          this.insertarOActualizarOrden(data.orden, data.cambios || []);
        }
      }),
      this.reverb.escucharCanal('canal-ordenes', '.PuestoCocinaActualizado').subscribe((data: { id?: number; nombre?: string; estacion_id?: number; ocupado?: boolean; user_id?: number | null; user_nombre?: string | null; orden_id?: number | null; orden_numero?: number | null }) => {
        if (data?.id) {
          this.handlePuestoActualizadoEvent({
            ...data,
            id: data.id
        });
        }
      }),
      this.reverb.escucharCanal('canal-ordenes', '.PuestoCocinaOrdenAsignada').subscribe((data: { id?: number; nombre?: string; estacion_id?: number; ocupado?: boolean; user_id?: number | null; user_nombre?: string | null; orden_id?: number | null; orden_numero?: number | null }) => {
        if (data?.id) {
          this.handlePuestoActualizadoEvent({
            ...data,
            id: data.id,
          });
        }
      }),
      this.reverb.escucharCanal('canal-ordenes', '.PuestoCocinaOrdenLista').subscribe((data: any) => {
        if (data?.puesto?.id) {
          this.handlePuestoActualizadoEvent({
            id: data.puesto.id,
            nombre: data.puesto.nombre,
            estacion_id: data.puesto.estacion_id,
            ocupado: data.puesto.ocupado,
            user_id: data.puesto.user_id,
            user_nombre: data.puesto.user_nombre,
            orden_id: data.puesto.orden_id,
            orden_numero: data.puesto.orden_numero,
            orden_estado_cocina: data.puesto.orden_estado_cocina,
          });
        }
      }),
    );
  }

  cargarPedidos(): void {
    this.isLoading.set(true);
    this.cocinaService.obtenerPedidos(this.fechaSeleccionada()).subscribe({
      next: (res: any) => {
        if (res.debug) console.log('CocinaController debug ->', res.debug);
        console.log('Pedidos recibidos', res.ordenes);
        const ordenes = res.ordenes || [];
        console.log('Pedidos recibidos count:', ordenes.length);
        console.log('Pedidos recibidos sample:', ordenes.slice(0,3).map((o: any) => ({ id: o.id, detalles_count: o.detalles?.length, detalles_sample: (o.detalles || []).slice(0,3).map((d: any) => ({ id: d.id, estacion_id: d.estacion_id, producto_id: d.producto?.id, producto_estacion_id: d.producto?.estacion_id })) })));
        this.ordenes.set(ordenes.map((orden: KdsOrden) => this.filtrarOrdenPorEstacion(orden)));
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
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

  cargarPuestos(): void {
    this.puestosLoading.set(true);
    this.puestosCocinaService.obtenerPuestos().subscribe({
      next: (res) => {
        this.puestos.set(res.puestos || []);
        this.puestosLoading.set(false);
      },
      error: (err) => {
        this.puestosLoading.set(false);
        console.log(err);
        this.toastr.error(err?.error?.message || 'No se pudieron cargar los puestos de Cocina.');
      },
    });
  }

  ocuparPuesto(puesto: PuestoCocina): void {
    if (this.puestoActual() !== null) {
      return;
    }

    this.puestosCocinaService.ocuparPuesto(puesto.id).subscribe({
      next: (respuesta) => {
        this.actualizarPuestoLocal(respuesta.puesto);
        this.toastr.success(`Has ocupado ${respuesta.puesto.nombre}.`);
      },
      error: (err) => {
        this.toastr.error(err?.error?.message || 'No se pudo ocupar el puesto.');
      },
    });
  }

  liberarPuesto(puesto: PuestoCocina): void {
    if (this.puestoActual()?.id !== puesto.id) {
      return;
    }

    this.puestosCocinaService.liberarPuesto(puesto.id).subscribe({
      next: (respuesta) => {
        this.actualizarPuestoLocal(respuesta.puesto);
        this.toastr.success(`${respuesta.puesto.nombre} ha quedado disponible.`);
      },
      error: (err) => {
        this.toastr.error(err?.error?.message || 'No se pudo liberar el puesto.');
      },
    });
  }

  seleccionarOrden(puesto: PuestoCocina, event: Event): void {
    const ordenId = (event.target as HTMLSelectElement).value;
    this.selectedOrdenPorPuesto.update((state) => ({
      ...state,
      [puesto.id]: ordenId ? Number(ordenId) : null,
    }));
  }

  asignarOrden(puesto: PuestoCocina): void {
    const ordenId = this.selectedOrdenPorPuesto()[puesto.id];

    if (!ordenId) {
      this.toastr.warning('Selecciona una orden para asignar al puesto.');
      return;
    }

    this.puestosCocinaService.asignarOrden(puesto.id, ordenId).subscribe({
      next: (respuesta) => {
        this.actualizarPuestoLocal(respuesta.puesto);
        this.selectedOrdenPorPuesto.update((state) => {
          const { [puesto.id]: _, ...rest } = state;
          return rest;
        });
        this.toastr.success(`Orden #${respuesta.puesto.orden_numero || respuesta.puesto.orden_id} asignada a ${respuesta.puesto.nombre}.`);
      },
      error: (err) => {
        this.toastr.error(err?.error?.message || 'No se pudo asignar la orden al puesto.');
      },
    });
  }

  liberarOrden(puesto: PuestoCocina): void {
    if (this.puestoActual()?.id !== puesto.id) {
      return;
    }

    this.puestosCocinaService.liberarOrden(puesto.id).subscribe({
      next: (respuesta) => {
        this.actualizarPuestoLocal(respuesta.puesto);
        this.toastr.success(`Orden liberada de ${respuesta.puesto.nombre}.`);
      },
      error: (err) => {
        this.toastr.error(err?.error?.message || 'No se pudo liberar la orden del puesto.');
      },
    });
  }

  marcarOrdenLista(puesto: PuestoCocina): void {
    if (this.puestoActual()?.id !== puesto.id) {
      return;
    }

    this.puestosCocinaService.marcarOrdenLista(puesto.id).subscribe({
      next: (respuesta) => {
        this.actualizarPuestoLocal(respuesta.puesto);
        this.toastr.success(`Orden #${respuesta.orden.numero_orden || respuesta.orden.id} marcada como lista.`);
      },
      error: (err) => {
        this.toastr.error(err?.error?.message || 'No se pudo marcar la orden como lista.');
      },
    });
  }

  private actualizarPuestoLocal(puesto: PuestoCocina): void {
    this.puestos.update((puestos) => {
      const index = puestos.findIndex((item) => item.id === puesto.id);
      if (index === -1) {
        return [...puestos, puesto];
      }
      return puestos.map((item) => item.id === puesto.id ? puesto : item);
    });
  }

  private handlePuestoActualizadoEvent(data: { id: number; nombre?: string; estacion_id?: number; ocupado?: boolean; user_id?: number | null; user_nombre?: string | null; orden_id?: number | null; orden_numero?: number | null; orden_estado_cocina?: string | null }): void {
    // accept optional orden_estado_cocina from events
    const anyData = data as any;
    this.puestos.update((puestos) => {
      const index = puestos.findIndex((item) => item.id === data.id);
      const puestoActualizado: PuestoCocina = {
        id: data.id,
        estacion_id: data.estacion_id ?? 0,
        nombre: data.nombre || `Puesto ${data.id}`,
        user_id: data.ocupado ? data.user_id ?? null : null,
        user_nombre: data.ocupado ? data.user_nombre ?? null : null,
        orden_id: data.orden_id ?? null,
        orden_numero: data.orden_numero ?? null,
        // @ts-ignore
        orden_estado_cocina: anyData.orden_estado_cocina ?? anyData.puesto?.orden_estado_cocina ?? null,
      };

      if (index === -1) {
        return [...puestos, puestoActualizado];
      }

      return puestos.map((item) => item.id === data.id ? { ...item, ...puestoActualizado } : item);
    });
  }

  gruposPorCategoria(orden: KdsOrden): Array<{ categoria: string; detalles: KdsDetalle[] }> {
    const grupos = new Map<string, KdsDetalle[]>();
    orden.detalles.forEach((detalle) => {
      const categoria = detalle.producto.categoria?.nombre || 'Sin categoría';
      grupos.set(categoria, [...(grupos.get(categoria) || []), detalle]);
    });
    return [...grupos.entries()].map(([categoria, detalles]) => ({ categoria, detalles }));
  }

  marcarServido(detalle: KdsDetalle, servido: boolean): void {
    this.detalleActualizando.set(detalle.id);
    this.cocinaService.actualizarEstadoDetalle(detalle.id, servido ? 'servido' : 'pendiente').subscribe({
      next: (respuesta) => {
        this.detalleActualizando.set(null);
        this.actualizarDetalleLocal(respuesta);
      },
      error: () => this.detalleActualizando.set(null),
    });
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
        .filter((orden) => this.tieneDetallesPendientes(orden));
    });
  }

  private tieneDetallesPendientes(orden: KdsOrden): boolean {
    return orden.detalles.some((detalle) => detalle.estado_cocina === 'pendiente');
  }

  private debeMostrarseEnKds(orden: KdsOrden): boolean {
    if (!this.esDeFechaSeleccionada(orden)) {
      console.log('Orden ignorada por fecha:', orden.id, orden.created_at);
      return false;
    }

    const cuentaDetalles = orden.detalles.length > 0;
    const pendientes = this.tieneDetallesPendientes(orden);
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
    return minutos < 1 ? 'Ahora' : `${minutos} min`;
  }

  esUrgente(orden: KdsOrden): boolean {
    const fecha = new Date(orden.fecha_orden || orden.created_at);
    return Date.now() - fecha.getTime() >= 15 * 60 * 1000;
  }

  etiquetaTipoOrden(orden: KdsOrden): string {
    return orden.tipo_orden === 'dine-in' ? `Mesa ${orden.mesa?.numero || '—'}` : orden.tipo_orden === 'delivery' ? 'Delivery' : 'Para llevar';
  }

  private fechaDeHoy(): string {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  }

}
