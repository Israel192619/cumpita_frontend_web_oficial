import { describe, expect, it } from 'vitest';
import { User } from '../models';
import { homeForUser, userCanAccess } from './role-access';

const user = (role: string, station?: string): User => ({
  id: 1, name: role, email: `${role}@test.local`, role_id: 1,
  role: { id: 1, nombre: role },
  estacion: station ? { id: 1, nombre: station, codigo: station.toUpperCase(), activa: true, orden: 1 } : null,
});

describe('role access policy', () => {
  it('gives Administrator unrestricted access', () => {
    const admin = user('Admin');
    expect(['admin', 'pos', 'caja', 'kds', 'servicio'].every(module => userCanAccess(admin, module as any))).toBe(true);
  });

  it('limits Cajero to POS and Caja', () => {
    const cashier = user('Cajero');
    expect(userCanAccess(cashier, 'pos')).toBe(true);
    expect(userCanAccess(cashier, 'caja')).toBe(true);
    expect(userCanAccess(cashier, 'kds')).toBe(false);
    expect(homeForUser(cashier)).toBe('/pos');
  });

  it('routes Cocinero to the assigned station', () => {
    expect(homeForUser(user('Cocinero', 'Cocina'))).toBe('/app/kds/cocina');
    expect(homeForUser(user('Cocinero', 'Parrilla'))).toBe('/app/kds/parrilla');
  });

  it('limits Mesero and Despacho to Servicio', () => {
    for (const role of ['Mesero', 'Despacho']) {
      const current = user(role);
      expect(userCanAccess(current, 'servicio')).toBe(true);
      expect(userCanAccess(current, 'pos')).toBe(false);
      expect(homeForUser(current)).toBe('/app/servicio');
    }
  });
});
