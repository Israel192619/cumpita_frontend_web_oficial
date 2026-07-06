import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal, SimpleChanges } from '@angular/core';
import { Button } from '../button/button';
import { Loader } from '../loader/loader';
import { ErrorMessage } from '../error-message/error-message';

export interface TreeNode {
  id: number;
  nombre: string;
  children?: TreeNode[];
}

@Component({
  selector: 'app-tree',
  imports: [
    CommonModule, Button, Loader, ErrorMessage
  ],
  templateUrl: './tree.html',
  styleUrl: './tree.css',
})
export class Tree {
   @Input() title: string = '';
  @Input() data: TreeNode[] = [];

  @Input() loading: boolean = false;
  @Input() error: string | null = null;
  @Input() errorMessageLink: string | null = null;
  @Input() errorMessageText: string | null = null;
  @Input() createLink?: string;

  @Output() refresh = new EventEmitter<void>();
  @Output() nodeAction = new EventEmitter<{ type: string; node: TreeNode }>();

  columns = [
    { key: 'nombre', label: 'Nombre' },
    { key: 'descripcion', label: 'Descripción' },
    { key: 'created_at', label: 'Creado', type: 'date' }
  ];

  flatData: any[] = [];

  expanded = signal<Set<number>>(new Set());

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this.flatData = this.flatten(this.data);
    }
  }

  toggle(id: number) {
    const set = new Set(this.expanded());
    set.has(id) ? set.delete(id) : set.add(id);
    this.expanded.set(set);
  }

  isExpanded(id: number): boolean {
    return this.expanded().has(id);
  }

  isVisible(node: any): boolean {
    if (!node.parent_id) return true;
    return this.expanded().has(node.parent_id);
  }

  flatten(data: TreeNode[], parentId: number | null = null, level = 0): any[] {
    let result: any[] = [];

    data.forEach(node => {
      result.push({
        ...node,
        level,
        parent_id: parentId
      });

      if (node.children?.length) {
        result = result.concat(this.flatten(node.children, node.id, level + 1));
      }
    });

    return result;
  }

  getValue(item: any, key: string) {
    return item[key];
  }
}
