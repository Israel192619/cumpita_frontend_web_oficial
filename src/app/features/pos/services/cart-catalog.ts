import { Producto } from '../../../core/models/producto';
import { CartItem } from './pos-service';

export type CambioProducto = Pick<Producto, 'id' | 'precio' | 'activo'> & Partial<Producto>;

export function sincronizarProductoCarrito(items: CartItem[], producto: CambioProducto): CartItem[] {
  let cambiado = false;
  const resultado = items.map(item => {
    if (item.producto.id !== producto.id) return item;
    const mismoCatalogo = Object.entries(producto).every(([clave, valor]) =>
      JSON.stringify(item.producto[clave as keyof Producto]) === JSON.stringify(valor));
    if (mismoCatalogo && (item.orden_detalle_id || Number(item.precio_unitario) === Number(producto.precio))) return item;
    cambiado = true;
    const catalogo = { ...item.producto, ...producto };
    // Cada detalle persistido conserva el precio de la venta, incluso al desactivarse.
    if (item.orden_detalle_id) return { ...item, producto: catalogo };
    const precio = Number(producto.precio);
    const extras = (item.modificadores ?? []).reduce((total, mod) => total + Number(mod.precio_extra), 0);
    return { ...item, producto: catalogo, precio_unitario: precio, subtotal: (precio + extras) * item.cantidad };
  });
  return cambiado ? resultado : items;
}
