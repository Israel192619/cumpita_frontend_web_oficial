import { Component, computed, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { homeForUser, isAdministrator, kdsStation, userCanAccess } from '../../auth/role-access';
import { User } from '../../models';
import { AuthService } from '../../services/auth-service';

interface NavChild { label: string; route: string; }
interface NavGroup { key: string; label: string; icon: string; children: NavChild[]; }

@Component({ selector: 'app-sidebar', imports: [RouterLink, RouterLinkActive], templateUrl: './sidebar.html', styleUrl: './sidebar.css' })
export class Sidebar implements OnInit {
  @Input() collapsed = false;
  @Output() linkSelected = new EventEmitter<void>();

  readonly user = signal<User | null>(null);
  readonly loaded = signal(false);
  readonly expanded = signal<string | null>(null);
  readonly homeRoute = computed(() => this.user() ? homeForUser(this.user()!) : '/app');
  readonly directLinks = computed<NavChild[]>(() => {
    const user = this.user();
    if (!user || isAdministrator(user)) return [];
    if (userCanAccess(user, 'pos')) return [{ label: 'POS', route: '/pos' }];
    if (userCanAccess(user, 'kds')) return [{ label: `KDS ${kdsStation(user) === 'parrilla' ? 'Parrilla' : 'Cocina'}`, route: `/app/kds/${kdsStation(user)}` }];
    if (userCanAccess(user, 'servicio')) return [{ label: 'Servicio', route: '/app/servicio' }];
    return [];
  });
  readonly visibleGroups = computed<NavGroup[]>(() => {
    const user = this.user();
    if (!user) return [];
    if (isAdministrator(user)) return this.adminGroups;
    if (userCanAccess(user, 'caja')) return [this.cashGroup];
    return [];
  });

  private readonly cashGroup: NavGroup = { key: 'cajas', label: 'Gestión de Caja', icon: '$', children: [
    { label: 'Movimientos', route: '/app/movimientos-caja' }, { label: 'Gastos', route: '/app/gastos-caja' }
  ]};
  private readonly adminGroups: NavGroup[] = [
    { key: 'operacion', label: 'Operación', icon: 'O', children: [
      { label: 'POS', route: '/pos' }, { label: 'Órdenes', route: '/app/pedidos' }, { label: 'Mesas', route: '/app/mesas' },
      { label: 'KDS Cocina', route: '/app/kds/cocina' }, { label: 'KDS Parrilla', route: '/app/kds/parrilla' }, { label: 'Servicio / Despacho', route: '/app/servicio' }
    ]},
    { key: 'productos', label: 'Productos', icon: 'P', children: [
      { label: 'Productos', route: '/app/productos' }, { label: 'Categorías', route: '/app/categorias' },
      { label: 'Estaciones de trabajo', route: '/app/estaciones-trabajo' }, { label: 'Modificadores', route: '/app/modificadores' }
    ]},
    { key: 'contactos', label: 'Contactos', icon: 'C', children: [{ label: 'Clientes', route: '/app/clientes' }] },
    { key: 'usuarios', label: 'Administración', icon: 'U', children: [{ label: 'Usuarios', route: '/app/users' }] },
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
  iconFor(label: string): string { return label.startsWith('KDS') ? 'K' : label === 'POS' ? 'P' : 'S'; }

  private syncExpanded(url: string): void {
    const group = this.visibleGroups().find(item => item.children.some(child => url.startsWith(child.route)));
    this.expanded.set(group?.key ?? null);
  }
}
