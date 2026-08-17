import { Injectable, signal } from '@angular/core';

export type AppTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'tonito_theme';
  readonly theme = signal<AppTheme>('light');

  initialize(): void {
    const saved = localStorage.getItem(this.storageKey) as AppTheme | null;
    const preferred = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    this.apply(saved === 'light' || saved === 'dark' ? saved : preferred, false);
  }

  toggle(): void { this.apply(this.theme() === 'light' ? 'dark' : 'light'); }

  private apply(theme: AppTheme, persist = true): void {
    this.theme.set(theme);
    document.documentElement.dataset['theme'] = theme;
    document.documentElement.style.colorScheme = theme;
    // Compatibilidad temporal con los controles compartidos que ya tenían variante oscura.
    document.body.dataset['pcTheme'] = theme;
    if (persist) localStorage.setItem(this.storageKey, theme);
  }
}
