import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Footer } from '../../../core/components/footer/footer';
import { Header } from '../../../core/components/header/header';
import { Sidebar } from '../../../core/components/sidebar/sidebar';
import { ThemeService } from '../../../core/services/theme-service';

@Component({
  selector: 'app-main-layout',
  imports: [Header, Sidebar, Footer, RouterOutlet],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout implements OnInit {
  readonly sidebarCollapsed = signal(false);
  readonly mobileSidebarOpen = signal(false);

  constructor(readonly themeService: ThemeService) {}
  ngOnInit(): void { this.themeService.initialize(); }

  toggleSidebar(): void {
    if (matchMedia('(max-width: 900px)').matches) this.mobileSidebarOpen.update(open => !open);
    else this.sidebarCollapsed.update(collapsed => !collapsed);
  }

  closeMobileSidebar(): void { this.mobileSidebarOpen.set(false); }
}
