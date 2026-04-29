export interface User {
  id: number;
  name: string;
  email: string;
  role_id: number;
  perfil_usuarios?: PerfilUsuario;
  created_at?: string;
  updated_at?: string;
}

export interface PerfilUsuario {
  direccion?: string;
  numero_celular?: string;
  avatar?: string;
  avatar_url?: string;
}

export type CreateUser = {
  name: string;
  email: string;
  password: string;
  role_id: number;
};

export type UpdateUser = Partial<CreateUser>;