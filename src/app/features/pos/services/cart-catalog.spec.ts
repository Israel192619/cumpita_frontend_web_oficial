import { describe, expect, it } from 'vitest';
import { Producto } from '../../../core/models/producto';
import { CartItem } from './pos-service';
import { sincronizarProductoCarrito } from './cart-catalog';

const producto: Producto = { id: 1, categoria_id: 1, nombre: 'Refresco', precio: 10, activo: true, maneja_stock: false };
const nuevo: CartItem = { id: 10, producto, cantidad: 2, precio_unitario: 10, subtotal: 24,
  modificadores: [{ modificador_id: 1, opcion_id: 2, opcion_nombre: 'Extra', precio_extra: 2 }] };

describe('Cambios de catálogo en el carrito', () => {
  it.each([8, 15])('actualiza unidades nuevas a %s y conserva las vendidas', precio => {
    const vendido = { ...nuevo, id: 11, orden_detalle_id: 90 };
    const resultado = sincronizarProductoCarrito([nuevo, vendido], { ...producto, precio });
    expect(resultado[0].precio_unitario).toBe(precio);
    expect(resultado[0].subtotal).toBe((precio + 2) * 2);
    expect(resultado[1].precio_unitario).toBe(10);
    expect(resultado[1].subtotal).toBe(24);
    expect(resultado[1].orden_detalle_id).toBe(90);
    expect(nuevo.precio_unitario).toBe(10);
  });

  it('conserva la línea desactivada para retirarla y permite reactivarla', () => {
    const desactivados = sincronizarProductoCarrito([nuevo], { ...producto, activo: false });
    expect(desactivados).toHaveLength(1);
    expect(desactivados[0].producto.activo).toBe(false);
    expect(sincronizarProductoCarrito(desactivados, producto)[0].producto.activo).toBe(true);
  });

  it('no cambia otros productos', () => {
    const items = [nuevo];
    expect(sincronizarProductoCarrito(items, { ...producto, id: 3, precio: 50 })).toBe(items);
  });

  it('un refresco idéntico no vuelve a escribir el carrito', () => {
    const items = [nuevo];
    expect(sincronizarProductoCarrito(items, { ...producto })).toBe(items);
    const actualizado = sincronizarProductoCarrito(items, { ...producto, precio: 15 });
    expect(sincronizarProductoCarrito(actualizado, { ...producto, precio: 15 })).toBe(actualizado);
  });
});
