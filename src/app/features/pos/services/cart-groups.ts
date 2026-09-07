import { CartItem } from './pos-service';

export interface GrupoCarrito extends CartItem { lineas: CartItem[]; }

export function agruparCarrito(items: CartItem[]): GrupoCarrito[] {
  const grupos = new Map<string, GrupoCarrito>();
  for (const item of items) {
    const clave = JSON.stringify([
      item.producto.id, Number(item.precio_unitario).toFixed(2), item.nota?.trim() || '',
      (item.modificadores ?? []).map(mod => JSON.stringify([mod.modificador_id, mod.opcion_id, Number(mod.precio_extra).toFixed(2)])).sort(),
      !!item.requiresModifierSelection,
      !item.orden_detalle_id && !item.producto.activo,
    ]);
    const grupo = grupos.get(clave);
    if (grupo) {
      grupo.cantidad += item.cantidad;
      grupo.subtotal += item.subtotal;
      grupo.lineas.push(item);
    } else {
      grupos.set(clave, { ...item, lineas: [item] });
    }
  }
  return [...grupos.values()];
}
