import { Component, computed, effect, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { User } from '../../models';
import { AuthService } from '../../services/auth-service';
import { AppTheme } from '../../services/theme-service';
import { kdsStation, userCanAccess } from '../../auth/role-access';
import { Icon } from '../../../shared/components';

@Component({ selector: 'app-header', imports: [RouterLink, Icon], templateUrl: './header.html', styleUrl: './header.css' })
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

  constructor(private auth: AuthService, private router: Router, private elementRef: ElementRef<HTMLElement>) {
    this.user.set(this.auth.usuarioGuardado());
    effect(() => this.user.set(this.auth.usuarioActual()));
  }

  @HostListener('document:click', ['$event'])
  closeUserMenuFromOutside(event: MouseEvent): void {
    const userMenu = this.elementRef.nativeElement.querySelector('.user-menu');
    if (this.userMenuOpen() && userMenu && !userMenu.contains(event.target as Node)) {
      this.userMenuOpen.set(false);
    }
  }

  ngOnInit(): void {
    this.enServicio.set(this.router.url.startsWith('/servicio'));
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(event => {
      this.enServicio.set(event.urlAfterRedirects.startsWith('/servicio'));
      this.userMenuOpen.set(false);
    });
    this.auth.me().subscribe({ next: user => {
      this.user.set(user);
    }});
  }

  initials(): string { return (this.user()?.name ?? 'T').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
  avatarUrl(): string | null { return this.user()?.perfil_usuarios?.avatar_url ?? null; }
  logout(): void { this.userMenuOpen.set(false); this.auth.logout().subscribe(); }
}
