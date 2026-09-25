import { HttpClient } from '@angular/common/http';
import { Order, PosService } from './pos-service';

describe('PosService', () => {
  it('conserva el comentario general al preparar el pedido', () => {
    const service = new PosService({} as HttpClient);
    const order: Order = {
      id: 1,
      cliente_nombre: 'Ana',
      observaciones: '  Entregar todo junto  ',
      items: [{
        id: 1,
        producto: { id: 10, nombre: 'Pescado', precio: 45 } as any,
        cantidad: 1,
        precio_unitario: 45,
        subtotal: 45,
      }],
      subtotal: 45,
      total: 45,
    };

    expect(service.mapOrderToPayload(order).observaciones).toBe('Entregar todo junto');
  });

  it('no reutiliza el texto automático antiguo del cliente como comentario', () => {
    const service = new PosService({} as HttpClient);
    const order: Order = {
      id: 1,
      cliente_nombre: 'Prueba',
      observaciones: 'Cliente: Prueba',
      items: [{
        id: 1,
        producto: { id: 10, nombre: 'Pescado', precio: 45 } as any,
        cantidad: 1,
        precio_unitario: 45,
        subtotal: 45,
      }],
      subtotal: 45,
      total: 45,
    };

    expect(service.mapOrderToPayload(order).observaciones).toBeUndefined();
  });
});
