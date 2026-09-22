import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PosSearchFocus } from './pos-search-focus';

@Component({
  imports: [PosSearchFocus],
  template: `<div [posSearchFocus]="target()">
    <input data-pos-search="product"><input data-pos-search="client">
    <textarea></textarea><button>Agregar</button>
  </div>`,
})
class FocusHost {
  target = signal<'product' | 'client'>('product');
}

describe('Foco del buscador POS', () => {
  function setup(width = 1024) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    const fixture = TestBed.createComponent(FocusHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const product = root.querySelector<HTMLInputElement>('[data-pos-search="product"]')!;
    const client = root.querySelector<HTMLInputElement>('[data-pos-search="client"]')!;
    for (const input of [product, client]) input.getClientRects = () => [new DOMRect()] as any;
    const directive = fixture.debugElement.query(By.directive(PosSearchFocus)).injector.get(PosSearchFocus);
    return { fixture, root, product, client, directive };
  }

  it('enfoca productos al inicio y después de seleccionar un producto', () => {
    const { fixture, root, product, directive } = setup();
    directive.restoreFocus();
    expect(document.activeElement).toBe(product);
    root.querySelector('button')!.focus();
    directive.restoreFocus();
    expect(document.activeElement).toBe(product);
    fixture.destroy();
  });

  it('pasa a cliente cuando se requiere y regresa a productos al seleccionarlo', () => {
    const { fixture, product, client, directive } = setup();
    directive.restoreFocus();
    fixture.componentInstance.target.set('client');
    fixture.detectChanges();
    directive.restoreFocus();
    expect(document.activeElement).toBe(client);
    fixture.componentInstance.target.set('product');
    fixture.detectChanges();
    directive.restoreFocus();
    expect(document.activeElement).toBe(product);
    fixture.destroy();
  });

  it('respeta otros campos y los diálogos abiertos', () => {
    const { fixture, root, directive } = setup();
    const notes = root.querySelector('textarea')!;
    notes.focus();
    directive.restoreFocus();
    expect(document.activeElement).toBe(notes);
    const button = root.querySelector('button')!;
    button.focus();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    root.appendChild(dialog);
    directive.restoreFocus();
    expect(document.activeElement).toBe(button);
    dialog.remove();
    fixture.destroy();
  });

  it('no cambia el foco en móvil', () => {
    const { fixture, root, directive } = setup(390);
    const button = root.querySelector('button')!;
    button.focus();
    fixture.componentInstance.target.set('client');
    fixture.detectChanges();
    directive.restoreFocus();
    expect(document.activeElement).toBe(button);
    fixture.destroy();
  });
});
