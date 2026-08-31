import { Component, computed, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { User } from '../../models';
import { AuthService } from '../../services/auth-service';
import { AppTheme } from '../../services/theme-service';
import { kdsStation, userCanAccess } from '../../auth/role-access';

@Component({ selector: 'app-header', imports: [RouterLink], templateUrl: './header.html', styleUrl: './header.css' })
export class Header implements OnInit {
  @Input() theme: AppTheme = 'light';
  @Output() menuToggle = new EventEmitter<void>();
  @Output() themeToggle = new EventEmitter<void>();

  readonly user = signal<User | null>(null);
  readonly canOpenPos = computed(() => !!this.user() && userCanAccess(this.user()!, 'pos'));
  readonly canOpenKds = computed(() => !!this.user() && userCanAccess(this.user()!, 'kds'));
  readonly kdsRoute = computed(() => this.user() ? `/cocina/${kdsStation(this.user()!)}` : '/cocina');
  readonly enServicio = signal(false);
  readonly userMenuOpen = signal(false);

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.enServicio.set(this.router.url.startsWith('/app/servicio'));
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(event => {
      this.enServicio.set(event.urlAfterRedirects.startsWith('/app/servicio'));
      this.userMenuOpen.set(false);
    });
    this.auth.me().subscribe({ next: user => {
      this.user.set(user);
    }});
  }

  initials(): string { return (this.user()?.name ?? 'T').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
  logout(): void { this.userMenuOpen.set(false); this.auth.logout().subscribe(); }
}
