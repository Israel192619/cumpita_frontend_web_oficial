export interface EstacionTrabajo {
  id: number;
  nombre: string;
  codigo: string;
  descripcion?: string | null;
  activa: boolean;
  orden: number;
  created_at?: string;
  updated_at?: string;
}

export interface EstacionTrabajoPayload {
  nombre: string;
  codigo: string;
  descripcion?: string | null;
  activa?: boolean;
  orden?: number;
}
