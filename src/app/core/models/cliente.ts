export interface Cliente {
  id: number;
  nombre: string;
  telefono?: string;
  direccion?: string | null;
  referencia_ubicacion?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  foto_local?: string | null;
  foto_local_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type CreateCliente = {
  nombre: string;
  telefono?: string;
  direccion?: string | null;
  referencia_ubicacion?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  foto_local?: File | null;
};

export type UpdateCliente = Partial<CreateCliente>;
