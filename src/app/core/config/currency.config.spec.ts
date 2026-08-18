import { CURRENCY_CONFIG, formatCurrency, formatCurrencyAmount } from './currency.config';

describe('currency config', () => {
  it('uses Bolivianos as the single configured currency', () => {
    expect(CURRENCY_CONFIG).toMatchObject({ code: 'BOB', symbol: 'Bs', decimals: 2 });
  });

  it('formats values with the configured symbol and decimals', () => {
    expect(formatCurrency(12)).toBe(`Bs ${formatCurrencyAmount(12)}`);
    expect(formatCurrencyAmount(12)).toMatch(/12[,.]00$/);
  });

  it('handles API strings and invalid values safely', () => {
    expect(formatCurrency('10.5')).toBe(`Bs ${formatCurrencyAmount(10.5)}`);
    expect(formatCurrency(null)).toBe(`Bs ${formatCurrencyAmount(0)}`);
  });
});
