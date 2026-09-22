import { afterEveryRender, Directive, ElementRef, HostListener, inject, input, OnDestroy } from '@angular/core';

@Directive({ selector: '[posSearchFocus]', standalone: true })
export class PosSearchFocus implements OnDestroy {
  posSearchFocus = input<'product' | 'client'>('product');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private timer?: ReturnType<typeof setTimeout>;
  private previousTarget = 'product';
  private readonly renderRef = afterEveryRender(() => this.restoreFocus());

  @HostListener('click')
  @HostListener('focusout')
  @HostListener('window:resize')
  scheduleFocus(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.restoreFocus());
  }

  restoreFocus(): void {
    const host = this.host.nativeElement;
    const doc = host.ownerDocument;
    if (window.innerWidth <= 700) return;
    // Los diálogos y otros campos deben seguir permitiendo escribir normalmente.
    if (doc.querySelector('[role="dialog"], [role="alertdialog"], details[open]')) return;
    const target = this.posSearchFocus();
    const changed = target !== this.previousTarget;
    this.previousTarget = target;
    const active = doc.activeElement;
    if (active && active !== doc.body && !host.contains(active)) return;
    if (!changed && active?.matches('input, textarea, select, [contenteditable="true"]')) return;
    const candidates = host.querySelectorAll<HTMLInputElement>(`[data-pos-search="${target}"]`);
    const input = Array.from(candidates).find(candidate => !candidate.disabled && candidate.getClientRects().length > 0);
    input?.focus({ preventScroll: true });
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
    this.renderRef.destroy();
  }
}
