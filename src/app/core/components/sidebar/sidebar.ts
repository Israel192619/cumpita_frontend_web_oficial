import { Component, computed, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { homeForUser, isAdministrator, kdsStation, userCanAccess } from '../../auth/role-access';
import { User } from '../../models';
import { AuthService } from '../../services/auth-service';
import { Icon } from '../../../shared/components';
import { environment } from '../../../../environments/environment';

interface NavChild { label: string; route: string; }
interface NavGroup { key: string; label: string; icon: string; children: NavChild[]; }

@Component({ selector: 'app-sidebar', imports: [RouterLink, RouterLinkActive, Icon], templateUrl: './sidebar.html', styleUrls: ['./sidebar.css', './sidebar-flyout.css'] })
export class Sidebar implements OnInit {
  @Input() collapsed = false;
  @Output() linkSelected = new EventEmitter<void>();

  readonly user = signal<User | null>(null);
  readonly nombreApp = environment.nombreApp;
  readonly loaded = signal(false);
  readonly expanded = signal<string | null>(null);
  readonly flyoutTop = signal(8);
  readonly homeRoute = computed(() => this.user() ? homeForUser(this.user()!) : '/app');
  readonly directLinks = computed<NavChild[]>(() => {
    const user = this.user();
    if (!user || isAdministrator(user)) return [];
    if (userCanAccess(user, 'pos')) return [{ label: 'POS', route: '/pos' }];
    if (userCanAccess(user, 'kds')) return [{ label: `KDS ${kdsStation(user) === 'parrilla' ? 'Parrilla' : 'Cocina'}`, route: `/cocina/${kdsStation(user)}` }];
    if (userCanAccess(user, 'servicio')) {
      const links = [{ label: 'Servicio', route: '/app/servicio' }];
      if (userCanAccess(user, 'preorden')) links.push({ label: 'Nueva preorden', route: '/app/preordenes/nueva' });
      return links;
    }
    return [];
  });
  readonly visibleGroups = computed<NavGroup[]>(() => {
    const user = this.user();
    if (!user) return [];
    if (isAdministrator(user)) return this.adminGroups;
    if (userCanAccess(user, 'caja')) return [this.cashGroup];
    return [];
  });

  private readonly cashGroup: NavGroup = { key: 'cajas', label: 'Gestión de Caja', icon: 'wallet', children: [
    { label: 'Movimientos', route: '/app/movimientos-caja' }, { label: 'Gastos', route: '/app/gastos-caja' }
  ]};
  private readonly adminGroups: NavGroup[] = [
    { key: 'operacion', label: 'Operación', icon: 'restaurant', children: [
      { label: 'POS', route: '/pos' }, { label: 'Órdenes', route: '/app/pedidos' }, { label: 'Mesas', route: '/app/mesas' },
      { label: 'KDS Cocina', route: '/cocina/cocina' }, { label: 'KDS Parrilla', route: '/cocina/parrilla' }, { label: 'Servicio / Despacho', route: '/app/servicio' }
    ]},
    { key: 'productos', label: 'Productos', icon: 'package', children: [
      { label: 'Productos', route: '/app/productos' }, { label: 'Categorías', route: '/app/categorias' },
      { label: 'Modificadores', route: '/app/modificadores' }, { label: 'Ajustes de stock', route: '/app/ajustes-stock' }
    ]},
    { key: 'contactos', label: 'Contactos', icon: 'users', children: [{ label: 'Clientes', route: '/app/clientes' }] },
    { key: 'usuarios', label: 'Administración', icon: 'settings', children: [{ label: 'Usuarios', route: '/app/users' }] },
    { key: 'reportes', label: 'Reportes', icon: 'report', children: [
      { label: 'Ventas', route: '/app/reportes/ventas' }, { label: 'Productos', route: '/app/reportes/productos' }, { label: 'Caja', route: '/app/reportes/caja' }
    ]},
    this.cashGroup,
  ];

  constructor(private router: Router, private auth: AuthService) {}

  ngOnInit(): void {
    this.auth.me().subscribe({ next: user => { this.user.set(user); this.loaded.set(true); }, error: () => this.loaded.set(true) });
    this.syncExpanded(this.router.url);
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(event => {
      this.syncExpanded(event.urlAfterRedirects); this.linkSelected.emit();
    });
  }

  toggleGroup(key: string): void { this.expanded.update(current => current === key ? null : key); }
  selectLink(): void { this.linkSelected.emit(); }
  iconFor(label: string): string {
    if (label === 'POS') return 'shopping-cart';
    if (label.startsWith('KDS')) return 'restaurant';
    return 'users';
  }
  positionFlyout(event: MouseEvent, itemCount: number): void {
    if (!this.collapsed || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const trigger = event.currentTarget as HTMLElement;
    const estimatedHeight = Math.min(window.innerHeight - 16, 52 + itemCount * 38);
    this.flyoutTop.set(Math.max(8, Math.min(trigger.getBoundingClientRect().top, window.innerHeight - estimatedHeight - 8)));
  }

  private syncExpanded(url: string): void {
    const group = this.visibleGroups().find(item => item.children.some(child => url.startsWith(child.route)));
    this.expanded.set(group?.key ?? null);
  }
}
