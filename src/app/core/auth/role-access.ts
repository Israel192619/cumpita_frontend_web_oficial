import { User } from '../models';

export type AppAccess = 'admin' | 'pos' | 'caja' | 'kds' | 'servicio' | 'preorden';

export const normalizeAccessName = (value?: string | null): string =>
  (value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

export const isAdministrator = (user: User): boolean =>
  ['admin', 'administrador', 'gerente'].includes(normalizeAccessName(user.role?.nombre));

export const userCanAccess = (user: User, access: AppAccess): boolean => {
  if (isAdministrator(user)) return true;
  const role = normalizeAccessName(user.role?.nombre);
  if (access === 'pos' || access === 'caja') return ['cajero', 'caja'].includes(role);
  if (access === 'kds') return ['cocinero', 'cocina', 'parrilla'].includes(role);
  if (access === 'servicio') return ['mesero', 'despacho'].includes(role);
  if (access === 'preorden') return ['mesero', 'cajero', 'caja'].includes(role);
  return false;
};

export const kdsStation = (user: User): 'cocina' | 'parrilla' => {
  const station = normalizeAccessName(user.estacion?.codigo || user.estacion?.nombre);
  return station.includes('parrilla') ? 'parrilla' : 'cocina';
};

export const homeForUser = (user: User): string => {
  if (isAdministrator(user)) return '/app';
  if (userCanAccess(user, 'pos')) return '/pos';
  if (userCanAccess(user, 'kds')) return `/app/kds/${kdsStation(user)}`;
  if (userCanAccess(user, 'servicio')) return '/app/servicio';
  return '/login';
};
