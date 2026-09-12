import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, signal, SimpleChanges, ViewChild } from '@angular/core';
import * as L from 'leaflet';

export interface MapLocation { latitud: number; longitud: number; }
@Component({
  selector: 'app-location-map',
  imports: [CommonModule],
  templateUrl: './location-map.html',
  styleUrl: './location-map.css',
})
export class LocationMap implements AfterViewInit, OnChanges, OnDestroy {
  @Input() latitud: number | null = null;
  @Input() longitud: number | null = null;
  @Input() editable = false;
  @Input() showCurrentLocation = false;
  @Input() showWalkingRoute = false;
  @Input() originLatitud: number | null = null;
  @Input() originLongitud: number | null = null;
  @Output() locationChange = new EventEmitter<MapLocation>();
  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;
  readonly locationStatus = signal<'idle' | 'locating' | 'ready' | 'insecure' | 'denied' | 'unavailable' | 'timeout'>('idle');

  private map?: L.Map;
  private marker?: L.Marker;
  protected currentMarker?: L.CircleMarker;
  private routeLine?: L.Polyline;
  private readonly defaultCenter: L.LatLngExpression = [-16.5, -64.5];

  ngAfterViewInit(): void {
    this.map = L.map(this.mapContainer!.nativeElement, { zoomControl: true, attributionControl: true })
      .setView(this.hasLocation() ? [this.latitud!, this.longitud!] : this.defaultCenter, this.hasLocation() ? 18 : 6);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);
    if (this.hasLocation()) this.setMarker(this.latitud!, this.longitud!, false);
    if (this.editable) this.map.on('click', event => this.setMarker(event.latlng.lat, event.latlng.lng, true));
    if (this.showCurrentLocation) this.locateCurrentPosition();
    else if (this.hasOrigin()) void this.drawOriginRoute();
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;
    if ((changes['latitud'] || changes['longitud']) && this.hasLocation()) this.setMarker(this.latitud!, this.longitud!, false);
    if ((changes['originLatitud'] || changes['originLongitud'] || changes['latitud'] || changes['longitud']) && this.hasOrigin()) void this.drawOriginRoute();
  }

  ngOnDestroy(): void { this.map?.remove(); }

  usarUbicacionActual(): void {
    if (!window.isSecureContext) { this.locationStatus.set('insecure'); return; }
    if (!navigator.geolocation) { this.locationStatus.set('unavailable'); return; }
    this.locationStatus.set('locating');
    navigator.geolocation.getCurrentPosition(
      posicion => { this.locationStatus.set('ready'); this.setMarker(posicion.coords.latitude, posicion.coords.longitude, true); },
      error => this.setLocationError(error),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 15000 },
    );
  }

  private locateCurrentPosition(): void {
    if (!window.isSecureContext) { this.locationStatus.set('insecure'); return; }
    if (!navigator.geolocation) { this.locationStatus.set('unavailable'); return; }
    this.locationStatus.set('locating');
    navigator.geolocation.getCurrentPosition(async posicion => {
      this.locationStatus.set('ready');
      const actual: L.LatLngExpression = [posicion.coords.latitude, posicion.coords.longitude];
      this.currentMarker = L.circleMarker(actual, {
        radius: 9, color: '#fff', weight: 3, fillColor: '#1677ff', fillOpacity: 1,
      }).addTo(this.map!).bindTooltip('Mi ubicación');
      if (this.hasLocation()) {
        this.map!.fitBounds(L.latLngBounds([actual, [this.latitud!, this.longitud!]]), { padding: [35, 35] });
        if (this.showWalkingRoute) await this.drawWalkingRoute(posicion.coords.latitude, posicion.coords.longitude);
      }
    }, error => this.setLocationError(error), { enableHighAccuracy: true, timeout: 15000, maximumAge: 15000 });
  }

  retryCurrentLocation(): void { this.locateCurrentPosition(); }

  locationMessage(): string {
    return ({
      idle: '', locating: 'Obteniendo tu ubicación…', ready: '',
      insecure: 'El celular bloqueó la ubicación porque el sistema se abrió sin conexión segura HTTPS.',
      denied: 'El permiso de ubicación está bloqueado. Habilítalo para este sitio desde los ajustes del navegador.',
      unavailable: 'El celular no pudo determinar la ubicación. Activa el GPS e inténtalo nuevamente.',
      timeout: 'La ubicación tardó demasiado. Revisa el GPS e inténtalo nuevamente.',
    } as const)[this.locationStatus()];
  }

  private setLocationError(error: GeolocationPositionError): void {
    this.locationStatus.set(error.code === error.PERMISSION_DENIED ? 'denied'
      : error.code === error.TIMEOUT ? 'timeout' : 'unavailable');
  }

  private async drawWalkingRoute(originLat: number, originLng: number): Promise<void> {
    try {
      const coordinates = `${originLng},${originLat};${this.longitud},${this.latitud}`;
      const response = await fetch(`https://routing.openstreetmap.de/routed-foot/route/v1/driving/${coordinates}?overview=full&geometries=geojson`);
      if (!response.ok) return;
      const data = await response.json() as { routes?: Array<{ geometry?: { coordinates?: number[][] } }> };
      const points = data.routes?.[0]?.geometry?.coordinates?.map(point => [point[1], point[0]] as L.LatLngExpression) ?? [];
      if (!points.length) return;
      this.routeLine?.remove();
      this.routeLine = L.polyline(points, { color: '#1677ff', weight: 6, opacity: .88 }).addTo(this.map!);
      this.map!.fitBounds(this.routeLine.getBounds(), { padding: [35, 35] });
    } catch { /* El mapa y ambos puntos siguen disponibles si el servidor de rutas no responde. */ }
  }

  private async drawOriginRoute(): Promise<void> {
    if (!this.map || !this.hasOrigin()) return;
    const origen: L.LatLngExpression = [this.originLatitud!, this.originLongitud!];
    if (!this.currentMarker) {
      this.currentMarker = L.circleMarker(origen, {
        radius: 9, color: '#fff', weight: 3, fillColor: '#1677ff', fillOpacity: 1,
      }).addTo(this.map).bindTooltip('Restaurante');
    } else this.currentMarker.setLatLng(origen);
    if (this.hasLocation()) {
      this.map.fitBounds(L.latLngBounds([origen, [this.latitud!, this.longitud!]]), { padding: [35, 35] });
      if (this.showWalkingRoute) await this.drawWalkingRoute(this.originLatitud!, this.originLongitud!);
    }
  }

  private hasLocation(): boolean { return this.latitud != null && this.longitud != null; }
  private hasOrigin(): boolean { return this.originLatitud != null && this.originLongitud != null; }

  private setMarker(latitud: number, longitud: number, emit: boolean): void {
    if (!this.map) return;
    if (!this.marker) {
      const icon = L.divIcon({ className: 'delivery-map-marker', html: '<span></span>', iconSize: [30, 40], iconAnchor: [15, 40] });
      this.marker = L.marker([latitud, longitud], { icon, draggable: this.editable }).addTo(this.map);
      if (this.editable) this.marker.on('dragend', () => {
        const point = this.marker!.getLatLng();
        this.locationChange.emit({ latitud: point.lat, longitud: point.lng });
      });
    } else this.marker.setLatLng([latitud, longitud]);
    this.map.setView([latitud, longitud], Math.max(this.map.getZoom(), 17));
    if (emit) this.locationChange.emit({ latitud, longitud });
  }
}
