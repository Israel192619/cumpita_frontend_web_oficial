import { CanDeactivateFn } from '@angular/router';
import { PosHome } from '../../features/pos/pages/pos-home/pos-home';

/** Protege tanto los botones internos como el Atrás del navegador/teléfono. */
export const pendingPosOrderGuard: CanDeactivateFn<PosHome> = component => component.confirmLeave();
