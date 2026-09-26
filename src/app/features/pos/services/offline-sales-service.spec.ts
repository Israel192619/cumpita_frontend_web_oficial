import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OfflineSalePayload, OfflineSalesService } from './offline-sales-service';

describe('OfflineSalesService', () => {
  let service: OfflineSalesService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('tonito-offline-sales-v1');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(OfflineSalesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('conserva una venta hasta que el servidor confirma la sincronización', async () => {
    const payload = salePayload('2f965dcb-3042-4d70-a129-878035f1ef81');

    await service.enqueue(payload);
    expect(service.pendingCount()).toBe(1);

    const syncing = service.syncPending();
    await new Promise(resolve => setTimeout(resolve, 0));
    const request = http.expectOne(req => req.url.endsWith('/ordenes'));
    expect(request.request.body.operacion_cliente_id).toBe(payload.operacion_cliente_id);
    request.flush({ orden: { id: 12 } });

    await expect(syncing).resolves.toEqual({ synced: 1, pending: 0, needsAttention: 0 });
    expect(service.pendingCount()).toBe(0);
  });

  it('no elimina la venta cuando el servidor sigue desconectado', async () => {
    await service.enqueue(salePayload('76d63370-638e-47e9-a941-b404d72e5c25'));

    const syncing = service.syncPending();
    await new Promise(resolve => setTimeout(resolve, 0));
    http.expectOne(req => req.url.endsWith('/ordenes')).error(new ProgressEvent('error'));

    await expect(syncing).resolves.toEqual({ synced: 0, pending: 1, needsAttention: 0 });
    expect(service.pendingCount()).toBe(1);
    expect(service.connected()).toBe(false);
  });
});

function salePayload(id: string): OfflineSalePayload {
  return {
    operacion_cliente_id: id,
    usuario_origen_id: 7,
    venta_sin_conexion: true,
    pagos: [{ metodo_pago: 'efectivo', monto_aplicado: 50, monto_recibido: 100 }],
    cliente_id: 2,
    items: [{ producto_id: 3, cantidad: 1, precio_unitario: 50 }],
    subtotal: 50,
    total: 50,
  };
}
