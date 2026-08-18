export const CURRENCY_CONFIG = {
  code: 'BOB',
  symbol: 'Bs',
  name: 'Boliviano',
  locale: 'es-BO',
  decimals: 2,
} as const;

export type CurrencyValue = number | string | null | undefined;

export function formatCurrencyAmount(value: CurrencyValue): string {
  const amount = typeof value === 'string' ? Number(value) : value;
  const safeAmount = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;

  return new Intl.NumberFormat(CURRENCY_CONFIG.locale, {
    minimumFractionDigits: CURRENCY_CONFIG.decimals,
    maximumFractionDigits: CURRENCY_CONFIG.decimals,
  }).format(safeAmount);
}

export function formatCurrency(value: CurrencyValue): string {
  return `${CURRENCY_CONFIG.symbol} ${formatCurrencyAmount(value)}`;
}
