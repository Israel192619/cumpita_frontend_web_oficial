export interface Cliente {
  id: number;
  nombre: string;
  telefono?: string;
  created_at?: string;
  updated_at?: string;
}

export type CreateCliente = {
  nombre: string;
  telefono?: string;
};

export type UpdateCliente = Partial<CreateCliente>;
