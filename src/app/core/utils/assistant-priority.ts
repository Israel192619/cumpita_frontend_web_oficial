function normalizar(valor?: string | null): string {
  return (valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function esProductoSalidaInmediata(categoria?: string | null, producto?: string | null): boolean {
  const texto = `${normalizar(categoria)} ${normalizar(producto)}`;
  return /\b(agua|aguas|bebida|bebidas|cerveza|cervezas|coctel|cocteles|gaseosa|gaseosas|jugo|jugos|refresco|refrescos|sopa|sopas|vino|vinos)\b/.test(texto);
}
