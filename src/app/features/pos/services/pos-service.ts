import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Categoria } from '@app/core/models/categoria';
import { Producto } from '@app/core/models/producto';
import { environment } from '../../../../environments/environment';
//import { Observable } from 'rxjs/internal/Observable';
//import { map } from 'rxjs/internal/operators/map';
import { Observable, map } from 'rxjs';

export interface CartItem {
  id: number;
  producto: Producto;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  modificadores?: CartItemModificador[];
}

export interface CartItemModificador {
  modificador_id: number;
  opcion_id: number;
  opcion_nombre: string;
  precio_extra: number;
}

export interface Mesa {
  id: number;
  numero: string;
  capacidad: number;
  estado: 'libre' | 'ocupada' | 'reservada' | 'mantenimiento';
  created_at?: string;
  updated_at?: string;
}

export interface ClienteSearch {
  id: number;
  nombre: string;
  telefono?: string;
}

export interface Order {
  id: number;
  numero_orden?: string;
  cliente_nombre?: string;
  cliente_telefono?: string;
  cliente_id?: number;
  tipo_orden?: 'dine-in' | 'to-go' | 'delivery';
  mesa_id?: number;
  items: CartItem[];
  subtotal: number;
  impuesto?: number;
  descuento?: number;
  total: number;
  metodo_pago: 'efectivo' | 'qr' | 'tarjeta';
  estado?: string;
  created_at?: string;
}

export interface OrderPayload {
  // cliente_nombre?: string;
  // cliente_telefono?: string;
  cliente_id?: number | null;
  tipo_orden?: 'dine-in' | 'to-go' | 'delivery';
  mesa_id?: number | null;
  items: OrderItem[];
  subtotal: number;
  descuento?: number;
  total: number;
  metodo_pago: 'efectivo' | 'qr' | 'tarjeta';
  observaciones?: string;
}

export interface OrderItem {
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  modificadores?: OrderItemModificador[];
}

export interface OrderItemModificador {
  modificador_opcion_id: number;
  precio_extra: number;
}

export interface PaymentMethodOption {
  id: string;
  nombre: string;
  icon?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PosService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  crearOrden(order: Order): Observable<any> {
    const payload = this.mapOrderToPayload(order);
    return this.http.post<any>(`${this.apiUrl}/ordenes`, payload);
  }

  obtenerOrdenes(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiUrl}/ordenes`);
  }

  obtenerOrdenPorId(id: number): Observable<{ orden: Order }> {
    return this.http.get<{ orden: Order }>(`${this.apiUrl}/ordenes/${id}`);
  }

  actualizarOrden(id: number, data: { estado?: string; metodo_pago?: string; observaciones?: string }): Observable<any> {
    return this.http.put(`${this.apiUrl}/ordenes/${id}`, data);
  }

  eliminarOrden(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/ordenes/${id}`);
  }

  obtenerMetodosPago(): Observable<PaymentMethodOption[]> {
    return this.http.get<PaymentMethodOption[]>(`${this.apiUrl}/payment-methods`);
  }

  buscarClientes(query: string): Observable<ClienteSearch[]> {
    return this.http.get<{ clientes: ClienteSearch[] }>(`${this.apiUrl}/clientes/search?q=${query}`).pipe(
      map(res => res.clientes || [])
    );
  }

  obtenerMesas(): Observable<Mesa[]> {
    return this.http.get<{ mesas: Mesa[] }>(`${this.apiUrl}/mesas`).pipe(
      map(res => res.mesas || [])
    );
  }

  crearCliente(nombre: string, telefono?: string): Observable<ClienteSearch> {
    return this.http.post<{ cliente: ClienteSearch }>(`${this.apiUrl}/clientes`, {
      nombre,
      telefono: telefono || null
    }).pipe(
      map(res => res.cliente)
    );
  }

  /**
   * Mapea un Order (del frontend) a OrderPayload (para el backend)
   */
  private mapOrderToPayload(order: Order): OrderPayload {
    return {
      cliente_id: order.cliente_id || null, // Asegura null en vez de undefined
      mesa_id: order.mesa_id || null,       // Asegura null en vez de undefined
      //cliente_nombre: order.cliente_nombre || null,
      //cliente_telefono: order.cliente_telefono || null,
      tipo_orden: order.tipo_orden || 'dine-in',
      subtotal: order.subtotal,
      descuento: order.descuento || 0,
      total: order.total,
      metodo_pago: order.metodo_pago,
      observaciones: order.cliente_nombre ? `Cliente: ${order.cliente_nombre}` : undefined,
      
      items: order.items.map(item => ({
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        modificadores: (item.modificadores || []).map(mod => ({
          modificador_opcion_id: mod.opcion_id,
          precio_extra: mod.precio_extra,
        })),
      })),
    };
  }
}

