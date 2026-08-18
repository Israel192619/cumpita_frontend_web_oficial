import { Component, effect, input, output, signal } from '@angular/core';
import { DatePicker } from '../date-picker/date-picker';

export interface DateRangeValue { from: string | null; to: string | null; includeTime: boolean; }

@Component({ selector: 'app-date-range-picker', imports: [DatePicker], templateUrl: './date-range-picker.html', styleUrl: './date-range-picker.css' })
export class DateRangePicker {
  value = input<DateRangeValue | null>(null);
  withTime = input(false);
  allowTimeToggle = input(true);
  disabled = input(false);
  min = input<string | null>(null);
  max = input<string | null>(null);
  valueChange = output<DateRangeValue>();
  from = signal<string | null>(null);
  to = signal<string | null>(null);
  includeTime = signal(false);

  constructor() { effect(() => { const value = this.value(); this.from.set(value?.from ?? null); this.to.set(value?.to ?? null); this.includeTime.set(value?.includeTime ?? this.withTime()); }); }
  get error(): string | null { return this.from() && this.to() && this.toComparable(this.from()!) > this.toComparable(this.to()!) ? 'La fecha inicial no puede ser posterior a la final.' : null; }
  setFrom(value: string | null): void { this.from.set(value); this.emit(); }
  setTo(value: string | null): void { this.to.set(value); this.emit(); }
  toggleTime(checked: boolean): void { this.includeTime.set(checked); if (!checked) { this.from.set(this.dateOnly(this.from())); this.to.set(this.dateOnly(this.to())); } this.emit(); }
  clear(): void { this.from.set(null); this.to.set(null); this.emit(); }
  private emit(): void { this.valueChange.emit({ from: this.from(), to: this.to(), includeTime: this.includeTime() }); }
  private dateOnly(value: string | null): string | null { return value?.split('T')[0] || null; }
  private toComparable(value: string): string { return this.includeTime() ? value : value.split('T')[0]; }
}
