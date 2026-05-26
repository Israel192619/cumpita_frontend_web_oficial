export interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string;
  parent_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export type CreateCategoria = {
  nombre: string;
  descripcion?: string;
  parent_id?: number | null;
};

export type UpdateCategoria = Partial<CreateCategoria>;
