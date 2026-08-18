import { CommonModule } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';

@Component({ selector: 'app-date-picker', imports: [CommonModule], templateUrl: './date-picker.html', styleUrl: './date-picker.css' })
export class DatePicker {
  label = input('Fecha');
  timeLabel = input('Hora');
  value = input<string | null>(null);
  includeTime = input(false);
  required = input(false);
  disabled = input(false);
  compact = input(false);
  min = input<string | null>(null);
  max = input<string | null>(null);
  clearable = input(true);
  valueChange = output<string | null>();

  dateValue = computed(() => this.parts(this.value()).date);
  timeValue = computed(() => this.parts(this.value()).time);
  minDate = computed(() => this.parts(this.min()).date || null);
  maxDate = computed(() => this.parts(this.max()).date || null);

  onDate(value: string): void { this.emitValue(value, this.timeValue()); }
  onTime(value: string): void { this.emitValue(this.dateValue(), value); }
  clear(): void { if (!this.disabled()) this.valueChange.emit(null); }

  private emitValue(date: string, time: string): void {
    if (!date) { this.valueChange.emit(null); return; }
    this.valueChange.emit(this.includeTime() ? `${date}T${time || '00:00'}` : date);
  }

  private parts(value: string | null): { date: string; time: string } {
    if (!value) return { date: '', time: '' };
    const normalized = value.trim().replace(' ', 'T');
    const [date, rawTime = ''] = normalized.split('T');
    return { date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '', time: rawTime.slice(0, 5) };
  }
}
