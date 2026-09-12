import { Component, Input } from '@angular/core';

export type IconName =
  | 'arrow-down-right-circle'
  | 'arrow-up-right-circle'
  | 'arrow-left'
  | 'banknote'
  | 'calendar'
  | 'chevron-down'
  | 'chevron-right'
  | 'chevron-up'
  | 'clock'
  | 'clipboard'
  | 'coin'
  | 'credit-card'
  | 'dashboard'
  | 'dots'
  | 'edit'
  | 'eye'
  | 'eye-off'
  | 'menu'
  | 'map-pin'
  | 'maximize'
  | 'minimize'
  | 'log-out'
  | 'moon'
  | 'navigation'
  | 'qrcode'
  | 'package'
  | 'play'
  | 'report'
  | 'search'
  | 'restaurant'
  | 'settings'
  | 'shopping-cart'
  | 'sun'
  | 'trash'
  | 'trending-up'
  | 'user'
  | 'users'
  | 'wallet';

@Component({
  selector: 'app-icon',
  standalone: true,
  templateUrl: './icon.html',
  styleUrl: './icon.css',
})
export class Icon {
  @Input({ required: true }) name: IconName | string = 'dots';
  @Input() size: number | string = '1em';
  @Input() label: string | null = null;

  get iconName(): string {
    const value = String(this.name || '').trim();
    const legacyMatch = value.match(/(?:^|\s)ti-([a-z0-9-]+)(?:\s|$)/i);
    return legacyMatch?.[1] ?? value;
  }

  get cssSize(): string {
    return typeof this.size === 'number' ? `${this.size}px` : this.size;
  }

}
