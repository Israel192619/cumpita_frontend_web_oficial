import { environment } from '../../../environments/environment';
import { Producto } from '../models/producto';

export function resolveApiAssetUrl(value?: string | null): string | null {
  if (!value) return null;
  if (/^(?:https?:|data:|blob:)/i.test(value)) return value;
  if (!value.startsWith('/storage/') && !value.startsWith('storage/')) return value;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const storageBase = new URL(environment.imageBaseUrl, origin);
  const relativePath = value.replace(/^\/?storage\//, '');
  return new URL(relativePath, storageBase).toString();
}

export function resolveProductoAssetUrls<T extends Producto>(producto: T): T {
  return {
    ...producto,
    imagen_url: resolveApiAssetUrl(producto.imagen_url) ?? undefined,
    modificadores: (producto.modificadores ?? []).map(grupo => ({
      ...grupo,
      opciones: (grupo.opciones ?? []).map(opcion => ({
        ...opcion,
        imagen_url: resolveApiAssetUrl(opcion.imagen_url),
      })),
    })),
  };
}
