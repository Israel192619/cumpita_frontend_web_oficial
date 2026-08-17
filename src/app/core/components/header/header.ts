import { Component, OnInit, signal } from '@angular/core';
import { AuthService } from '../../services/auth-service';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-header',
  imports: [
    RouterLink
  ],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnInit {
  esSoloServicio = signal(false);
  enServicio = signal(false);
  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.enServicio.set(this.router.url.startsWith('/app/servicio'));
    this.router.events.pipe(filter(evento => evento instanceof NavigationEnd)).subscribe(evento => {
      this.enServicio.set(evento.urlAfterRedirects.startsWith('/app/servicio'));
    });
    this.auth.me().subscribe({
      next: user => this.esSoloServicio.set(['mesero', 'despacho'].includes((user.role?.nombre ?? '').trim().toLocaleLowerCase()))
    });
  }
  
  logout() {
    this.auth.logout().subscribe();
  }
}
