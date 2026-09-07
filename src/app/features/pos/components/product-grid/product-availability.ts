import { Producto } from '@app/core/models/producto';

export function availableProductUnits(producto: Producto, usage: Record<number, number> = {}): number | null {
    if (producto.maneja_stock) return Math.max(0, producto.stock ?? producto.stock_disponible ?? 0);
    const capacities = (producto.modificadores || []).flatMap(group => {
      const stockOptions = (group.opciones || []).filter(option => option.activo !== false && option.maneja_stock);
      const required = Number(group.cantidad_requerida ?? (group.requerido ? 1 : 0));
      if (!stockOptions.length || required <= 0) return [];
      const total = stockOptions.reduce((sum, option) => {
        const available = Number(option.stock_disponible ?? option.stock ?? 0) - (usage[option.id] || 0);
        return sum + Math.max(0, available);
      }, 0);
      return [Math.floor(total / required)];
    });
    return capacities.length ? Math.min(...capacities) : null;
  }

