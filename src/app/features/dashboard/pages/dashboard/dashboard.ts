import { Component } from '@angular/core';
import { AppCurrencyPipe } from '@app/shared/pipes/app-currency.pipe';

@Component({
  selector: 'app-dashboard',
  imports: [AppCurrencyPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  menuOpen = false;
  period: 'month' | 'year' = 'month';
}
