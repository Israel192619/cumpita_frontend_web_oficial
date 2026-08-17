import { Component, Input, OnInit, Output, EventEmitter, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../services/auth-service';

interface NavChild { label: string; route: string; }
interface NavGroup { key: string; label: string; icon: string; children: NavChild[]; }

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit {
  @Input() collapsed = false;
  @Output() linkSelected = new EventEmitter<void>();

  readonly esSoloServicio = signal<boolean | null>(null);
  readonly expanded = signal<string | null>(null);
  readonly groups: NavGroup[] = [
    { key: 'usuarios', label: 'Gestión usuarios', icon: 'U', children: [
      { label: 'Usuarios', route: '/app/users' }
    ]},
    { key: 'productos', label: 'Productos', icon: 'P', children: [
      { label: 'Productos', route: '/app/productos' }, { label: 'Categorías', route: '/app/categorias' },
      { label: 'Estaciones de trabajo', route: '/app/estaciones-trabajo' }, { label: 'Modificadores', route: '/app/modificadores' }
    ]},
    { key: 'pedidos', label: 'Pedidos', icon: 'O', children: [
      { label: 'Pedidos', route: '/app/pedidos' }, { label: 'POS', route: '/pos' },
      { label: 'Mesas', route: '/app/mesas' }, { label: 'Servicio', route: '/app/servicio' }
    ]},
    { key: 'contactos', label: 'Contactos', icon: 'C', children: [{ label: 'Clientes', route: '/app/clientes' }] },
    { key: 'cajas', label: 'Cajas', icon: '$', children: [
      { label: 'Movimientos', route: '/app/movimientos-caja' }, { label: 'Gastos', route: '/app/gastos-caja' }
    ]}
  ];

  constructor(private router: Router, private auth: AuthService) {}

  ngOnInit(): void {
    this.auth.me().subscribe({
      next: user => this.esSoloServicio.set(['mesero', 'despacho'].includes((user.role?.nombre ?? '').trim().toLocaleLowerCase())),
      error: () => this.esSoloServicio.set(false)
    });
    this.syncExpanded(this.router.url);
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(event => {
      this.syncExpanded(event.urlAfterRedirects);
      this.linkSelected.emit();
    });
  }

  toggleGroup(key: string): void { this.expanded.update(current => current === key ? null : key); }
  selectLink(): void { this.linkSelected.emit(); }

  private syncExpanded(url: string): void {
    const group = this.groups.find(item => item.children.some(child => url.startsWith(child.route)));
    if (group) this.expanded.set(group.key);
  }
}
