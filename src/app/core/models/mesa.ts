export interface Mesa {
  id: number;
  numero: string;
  capacidad: number;
  estado: 'libre' | 'ocupada' | 'reservada' | 'mantenimiento';
  posicion_x?: number | null;
  posicion_y?: number | null;
  created_at?: string;
  updated_at?: string;
}

export type CreateMesa = {
  numero: string;
  capacidad: number;
  estado: 'libre' | 'ocupada' | 'reservada' | 'mantenimiento';
};

export type UpdateMesa = Partial<CreateMesa>;
