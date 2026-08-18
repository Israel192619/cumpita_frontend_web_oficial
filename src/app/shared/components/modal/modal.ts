import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, EventEmitter, HostListener, Inject, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';

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
  @Input() showClose = true;
  @Input() closeOnOverlay = true;
  @Input() closeOnEscape = true;
  @Input() busy = false;
  @Output() closed = new EventEmitter<void>();

  readonly titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;
  private previousOverflow = '';

  constructor(@Inject(DOCUMENT) private readonly document: Document) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) this.updateScrollLock();
  }

  ngOnDestroy(): void { this.unlockScroll(); }

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
}
