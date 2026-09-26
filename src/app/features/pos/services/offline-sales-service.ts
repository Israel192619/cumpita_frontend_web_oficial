import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { firstValueFrom, Subject } from 'rxjs';
import { OrderPayload } from './pos-service';

export interface InitialSalePayment {
  metodo_pago: 'efectivo' | 'qr';
  monto_aplicado: number;
  monto_recibido: number;
}

export interface OfflineSalePayload extends OrderPayload {
  operacion_cliente_id: string;
  usuario_origen_id: number;
  caja_id?: number | null;
  venta_sin_conexion: boolean;
  pagos: InitialSalePayment[];
}

interface PendingOfflineSale {
  id: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  requiresReview?: boolean;
  payload: OfflineSalePayload;
}

export interface OfflineSyncResult {
  synced: number;
  pending: number;
  needsAttention: number;
}

@Injectable({ providedIn: 'root' })
export class OfflineSalesService {
  readonly pendingCount = signal(0);
  readonly syncing = signal(false);
  readonly connected = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly needsAttention = signal(0);
  readonly synced = new Subject<number>();

  private readonly databaseName = 'tonito-pos';
  private readonly storeName = 'offline-sales';
  private readonly fallbackKey = 'tonito-offline-sales-v1';
  private started = false;
  private syncPromise?: Promise<OfflineSyncResult>;
  private retryTimer?: ReturnType<typeof setInterval>;

  constructor(private http: HttpClient) {}

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.refreshState();
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    this.retryTimer = setInterval(() => {
      if (this.pendingCount() > 0 && navigator.onLine) void this.syncPending();
    }, 15_000);
    if (navigator.onLine && this.pendingCount() > 0) void this.syncPending();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    if (this.retryTimer) clearInterval(this.retryTimer);
    this.retryTimer = undefined;
  }

  async enqueue(payload: OfflineSalePayload): Promise<void> {
    const sale: PendingOfflineSale = {
      id: payload.operacion_cliente_id,
      createdAt: Date.now(),
      attempts: 0,
      payload: { ...payload, venta_sin_conexion: true },
    };
    await this.put(sale);
    await this.refreshState();
  }

  syncPending(): Promise<OfflineSyncResult> {
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = this.performSync().finally(() => {
      this.syncPromise = undefined;
      this.syncing.set(false);
    });
    return this.syncPromise;
  }

  isConnectivityError(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) return false;
    return error.status === 0 || [408, 502, 503, 504].includes(error.status);
  }

  private async performSync(): Promise<OfflineSyncResult> {
    this.syncing.set(true);
    let synced = 0;
    const sales = (await this.getAll()).sort((a, b) => a.createdAt - b.createdAt);
    for (const sale of sales) {
      try {
        await firstValueFrom(this.http.post(`${environment.apiUrl}/ordenes`, sale.payload, { headers: { 'X-Offline-Queue': '1' } }));
        await this.remove(sale.id);
        synced++;
        this.connected.set(true);
      } catch (error) {
        sale.attempts++;
        sale.lastError = this.errorMessage(error);
        sale.requiresReview = !this.isConnectivityError(error);
        await this.put(sale);
        if (this.isConnectivityError(error)) {
          this.connected.set(false);
          break;
        }
      }
    }
    await this.refreshState();
    if (synced > 0) this.synced.next(synced);
    return { synced, pending: this.pendingCount(), needsAttention: this.needsAttention() };
  }

  private readonly handleOnline = () => {
    this.connected.set(true);
    void this.syncPending();
  };

  private readonly handleOffline = () => this.connected.set(false);

  private async refreshState(): Promise<void> {
    const sales = await this.getAll();
    this.pendingCount.set(sales.length);
    this.needsAttention.set(sales.filter(sale => sale.requiresReview).length);
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return error.error?.message || error.error?.error || `Error ${error.status || 'de conexión'}`;
    }
    return 'No se pudo sincronizar la venta.';
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB no disponible'));
      const request = indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) db.createObjectStore(this.storeName, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getAll(): Promise<PendingOfflineSale[]> {
    try {
      const db = await this.openDatabase();
      return await new Promise((resolve, reject) => {
        const request = db.transaction(this.storeName, 'readonly').objectStore(this.storeName).getAll();
        request.onsuccess = () => resolve(request.result as PendingOfflineSale[]);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return this.getFallback();
    }
  }

  private async put(sale: PendingOfflineSale): Promise<void> {
    try {
      const db = await this.openDatabase();
      await new Promise<void>((resolve, reject) => {
        const request = db.transaction(this.storeName, 'readwrite').objectStore(this.storeName).put(sale);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      const sales = this.getFallback().filter(item => item.id !== sale.id);
      localStorage.setItem(this.fallbackKey, JSON.stringify([...sales, sale]));
    }
  }

  private async remove(id: string): Promise<void> {
    try {
      const db = await this.openDatabase();
      await new Promise<void>((resolve, reject) => {
        const request = db.transaction(this.storeName, 'readwrite').objectStore(this.storeName).delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      localStorage.setItem(this.fallbackKey, JSON.stringify(this.getFallback().filter(item => item.id !== id)));
    }
  }

  private getFallback(): PendingOfflineSale[] {
    try { return JSON.parse(localStorage.getItem(this.fallbackKey) ?? '[]') as PendingOfflineSale[]; }
    catch { return []; }
  }
}
