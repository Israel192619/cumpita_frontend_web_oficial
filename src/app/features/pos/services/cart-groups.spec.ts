import { describe, expect, it } from 'vitest';
import { CartItem } from './pos-service';
import { agruparCarrito } from './cart-groups';
import { sincronizarProductoCarrito } from './cart-catalog';

const vendido: CartItem = { id: 1, orden_detalle_id: 20, producto: { id: 1, categoria_id: 1, nombre: 'Refresco', precio: 10, activo: true, maneja_stock: false }, cantidad: 1, precio_unitario: 10, subtotal: 10 };
const nuevo: CartItem = { ...vendido, id: 2, orden_detalle_id: undefined, cantidad: 2, subtotal: 20 };

describe('Agrupación visual del carrito', () => {
  it('une vendidos y nuevos iguales sin perder sus identificadores', () => {
    const grupos = agruparCarrito([vendido, nuevo]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].cantidad).toBe(3);
    expect(grupos[0].subtotal).toBe(30);
    expect(grupos[0].lineas.map(item => item.orden_detalle_id)).toEqual([20, undefined]);
    expect(vendido.cantidad).toBe(1);
  });
  it('separa precios distintos y vuelve a unirlos si coinciden', () => {
    const actualizado = sincronizarProductoCarrito([vendido, nuevo], { ...vendido.producto, precio: 15 });
    expect(agruparCarrito(actualizado)).toHaveLength(2);
    expect(agruparCarrito(sincronizarProductoCarrito(actualizado, vendido.producto))).toHaveLength(1);
  });
  it('separa notas, modificadores y cantidades de opciones diferentes', () => {
    const extra = { modificador_id: 1, opcion_id: 2, opcion_nombre: 'Hielo', precio_extra: 0 };
    expect(agruparCarrito([vendido, { ...nuevo, nota: 'Sin hielo' }])).toHaveLength(2);
    expect(agruparCarrito([vendido, { ...nuevo, modificadores: [extra] }])).toHaveLength(2);
    expect(agruparCarrito([{ ...vendido, modificadores: [extra] }, { ...nuevo, modificadores: [extra, extra] }])).toHaveLength(2);
  });
  it('ignora el orden de selección de opciones idénticas', () => {
    const a = { modificador_id: 1, opcion_id: 2, opcion_nombre: 'A', precio_extra: 0 };
    const b = { ...a, opcion_id: 3, opcion_nombre: 'B' };
    expect(agruparCarrito([{ ...vendido, modificadores: [a, b] }, { ...nuevo, modificadores: [b, a] }])).toHaveLength(1);
  });
  it('mantiene separada la nueva unidad inactiva que debe retirarse', () => {
    const items = sincronizarProductoCarrito([vendido, nuevo], { ...vendido.producto, activo: false });
    expect(agruparCarrito(items)).toHaveLength(2);
  });
});
