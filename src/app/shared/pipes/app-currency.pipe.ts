import { Pipe, PipeTransform } from '@angular/core';
import { CurrencyValue, formatCurrency } from '@app/core/config/currency.config';

@Pipe({
  name: 'appCurrency',
  standalone: true,
  pure: true,
})
export class AppCurrencyPipe implements PipeTransform {
  transform(value: CurrencyValue): string {
    return formatCurrency(value);
  }
}
