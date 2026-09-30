import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, EventEmitter, HostListener, Inject, Input, OnChanges, OnDestroy, Output, SimpleChanges, signal } from '@angular/core';

export type ModalSize = 'small' | 'medium' | 'large' | 'full';

@Component({
  selector: 'app-modal',
  imports: [CommonModule],
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class Modal implements OnChanges, OnDestroy {
  @Input() open = false;
  @Input() title = '';
  @Input() size: ModalSize = 'medium';
  @Input() panelClass = '';
  @Input() showClose = true;
  @Input() closeOnOverlay = true;
  @Input() closeOnEscape = true;
  @Input() busy = false;
  @Output() closed = new EventEmitter<void>();

  readonly titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;
  readonly viewportTop = signal(0);
  readonly viewportHeight = signal<number | null>(null);
  private previousOverflow = '';
  private visualViewport?: VisualViewport;

  constructor(@Inject(DOCUMENT) private readonly document: Document) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      this.updateScrollLock();
      if (this.open) this.startViewportTracking();
      else this.stopViewportTracking();
    }
  }

  ngOnDestroy(): void {
    this.stopViewportTracking();
    this.unlockScroll();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open && this.closeOnEscape && !this.busy) this.requestClose();
  }

  onOverlay(event: MouseEvent): void {
    if (event.target === event.currentTarget && this.closeOnOverlay && !this.busy) this.requestClose();
  }

  requestClose(): void {
    if (!this.busy) this.closed.emit();
  }

  private updateScrollLock(): void {
    if (this.open) {
      this.previousOverflow = this.document.body.style.overflow;
      this.document.body.style.overflow = 'hidden';
    } else this.unlockScroll();
  }

  private unlockScroll(): void {
    if (this.document.body.style.overflow === 'hidden') this.document.body.style.overflow = this.previousOverflow;
  }

  private startViewportTracking(): void {
    this.stopViewportTracking();
    this.visualViewport = this.document.defaultView?.visualViewport ?? undefined;
    this.syncVisualViewport();
    this.visualViewport?.addEventListener('resize', this.syncVisualViewport);
    this.visualViewport?.addEventListener('scroll', this.syncVisualViewport);
  }

  private stopViewportTracking(): void {
    this.visualViewport?.removeEventListener('resize', this.syncVisualViewport);
    this.visualViewport?.removeEventListener('scroll', this.syncVisualViewport);
    this.visualViewport = undefined;
    this.viewportTop.set(0);
    this.viewportHeight.set(null);
  }

  private readonly syncVisualViewport = (): void => {
    const viewport = this.visualViewport;
    if (!viewport) {
      this.viewportTop.set(0);
      this.viewportHeight.set(null);
      return;
    }
    this.viewportTop.set(Math.max(0, Math.round(viewport.offsetTop)));
    this.viewportHeight.set(Math.max(1, Math.round(viewport.height)));
  };
}
