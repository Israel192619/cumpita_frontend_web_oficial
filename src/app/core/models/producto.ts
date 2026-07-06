import { Categoria } from './categoria';

export interface ModificadorOpcion {
  id: number;
  nombre: string;
  precio_extra: number;
  activo: boolean;
  predeterminado: boolean;
}

export interface ModificadorEstructurado {
  id: number;
  nombre: string;
  tipo: 'unico' | 'multiple';
  requerido: boolean;
  activo: boolean;
  opciones?: ModificadorOpcion[];
}

export interface Producto {
  id: number;
  categoria_id: number;
  categoria?: Categoria;
  nombre: string;
  descripcion?: string;
  precio: number;
  activo: boolean;
  maneja_stock: boolean;
  stock?: number;
  stock_minimo?: number;
  imagen?: string;
  imagen_url?: string;
  modificadores?: ModificadorEstructurado[];
  //opciones?: ProductoOpcion[];
  created_at?: string;
  updated_at?: string;
}

export interface ProductoOpcion {
  id: number;
  modificador_opcion_id: number;
  predeterminado: boolean;
  opcion?: ModificadorOpcion;
}

export interface CreateProducto {
  categoria_id: number;
  nombre: string;
  descripcion?: string;
  precio: number;
  activo: boolean;
  maneja_stock: boolean;
  stock?: number;
  stock_minimo?: number;
  imagen?: File;
  // opciones?: Array<{
  //   id: number;
  //   predeterminado: boolean;
  // }>;
  opciones?: Array<{
    modificador_opcion_id: number;
    predeterminado: boolean;
  }>;
}

// export interface UpdateProducto extends CreateProducto {}
export interface UpdateProducto extends Partial<CreateProducto> {
  id: number; // Forzamos el ID para actualizaciones
}