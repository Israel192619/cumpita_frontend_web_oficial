import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Header } from '../../../core/components/header/header';
import { Footer } from '../../../core/components/footer/footer';
import { Sidebar } from '../../../core/components/sidebar/sidebar';

@Component({
  selector: 'app-main-layout',
  imports: [
    Header,
    Sidebar,
    Footer,
    RouterOutlet,
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {

private initialized = false;

  ngOnInit() {
    if (!this.initialized) {
      this.initialized = true;

      setTimeout(() => {
        document.dispatchEvent(new Event('DOMContentLoaded'));
      }, 0);
    }
  }
}
