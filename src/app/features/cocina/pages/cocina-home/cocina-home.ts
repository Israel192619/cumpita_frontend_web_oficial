import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ReverbService } from '@app/core/services/reverb-service';
import { ActualizacionEstadoCocinaResponse, CocinaService, KdsCambioOrden, KdsDetalle, KdsOrden } from '../../services/cocina-service';

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
  private subscriptions: Subscription[] = [];

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

  constructor(
    private cocinaService: CocinaService,
    private reverb: ReverbService,
  ) {}

  ngOnInit(): void {
    this.cargarPedidos();
    this.subscriptions.push(
      this.reverb.escucharCanal('canal-ordenes', '.OrdenCreada').subscribe((data: { orden?: KdsOrden }) => {
        if (data.orden) {
          //console.log('OrdenCreada recibida:', data.orden);
          this.insertarOActualizarOrden(data.orden);
        }
      }),
      this.reverb.escucharCanal('canal-ordenes', '.OrdenCocinaActualizada').subscribe((data: { orden?: KdsOrden; cambios?: KdsCambioOrden[] }) => {
        if (data.orden) {
          this.insertarOActualizarOrden(data.orden, data.cambios || []);
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  cargarPedidos(): void {
    this.isLoading.set(true);
    this.cocinaService.obtenerPedidos(this.fechaSeleccionada()).subscribe({
      next: ({ ordenes }) => {
        this.ordenes.set(ordenes);
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
    this.ordenes.update((ordenes) => {
      const anterior = ordenes.find((item) => item.id === orden.id);
      const sinOrdenActual = ordenes.filter((item) => item.id !== orden.id);

      if (!this.debeMostrarseEnKds(orden)) {
        console.log('Orden eliminada del KDS:', orden.id);
        return sinOrdenActual;
      }

      const ordenConCambios: KdsOrden = {
        ...orden,
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

    return orden.estado === 'cancelado'
      || (['pendiente', 'preparando', 'listo'].includes(orden.estado) && this.tieneDetallesPendientes(orden));
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
