import { Component, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../services/auth-service';

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterLink, RouterLinkActive
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  esSoloServicio = signal<boolean | null>(null);

  constructor(private router: Router, private auth: AuthService) {}

  ngOnInit() {
    this.auth.me().subscribe({
      next: user => this.esSoloServicio.set(['mesero', 'despacho'].includes((user.role?.nombre ?? '').trim().toLocaleLowerCase())),
      error: () => this.esSoloServicio.set(false)
    });
    // Escucha cambios de ruta para cerrar menús que no correspondan
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.syncMenu();
    });
  }

  ngAfterViewInit() {
    this.initMenuLogic();
  }

  // Esta es tu antigua función menu_click convertida a TS
  initMenuLogic() {
    const pcLinks = document.querySelectorAll('.pc-navbar > li.pc-hasmenu > .pc-link');
    
    pcLinks.forEach(link => {
      link.addEventListener('click', (event) => {
        event.stopPropagation();
        const parent = (event.currentTarget as HTMLElement).parentElement;
        
        if (!parent) return;

        if (parent.classList.contains('pc-trigger')) {
          parent.classList.remove('pc-trigger');
        } else {
          // Cerrar otros menús abiertos
          document.querySelectorAll('.pc-trigger').forEach(openItem => {
            openItem.classList.remove('pc-trigger');
          });
          parent.classList.add('pc-trigger');
        }
      });
    });
  }

  // Limpia y sincroniza el menú según la ruta actual
  syncMenu() {
    const allItems = document.querySelectorAll('.pc-item');
    allItems.forEach(item => {
      // Si Angular quitó el 'active', nosotros quitamos el 'pc-trigger'
      if (!item.classList.contains('active')) {
        item.classList.remove('pc-trigger');
      }
    });
  }
}
