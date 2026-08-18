import { Component } from '@angular/core';
import { AppCurrencyPipe } from '@app/shared/pipes/app-currency.pipe';
import { Icon } from '@app/shared/components/icon/icon';

@Component({
  selector: 'app-dashboard',
  imports: [AppCurrencyPipe, Icon],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  menuOpen = false;
  period: 'month' | 'year' = 'month';
}
