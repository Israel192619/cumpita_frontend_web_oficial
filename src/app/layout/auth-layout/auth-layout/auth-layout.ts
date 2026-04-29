import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  imports: [
    RouterOutlet
  ],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.css',
})
export class AuthLayout {
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
