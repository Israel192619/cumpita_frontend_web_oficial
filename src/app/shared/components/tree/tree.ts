import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, signal, SimpleChanges } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ErrorMessage } from '../error-message/error-message';

export interface TreeNode {
  id: number;
  nombre: string;
  descripcion?: string | null;
  created_at?: string | null;
  activo?: boolean;
  estado?: string;
  children?: TreeNode[];
}

interface FlatTreeNode extends TreeNode {
  level: number;
  parent_id: number | null;
  ancestor_ids: number[];
}

@Component({
  selector: 'app-tree',
  imports: [CommonModule, RouterLink, ErrorMessage],
  templateUrl: './tree.html',
  styleUrl: './tree.css',
})
export class Tree implements OnChanges {
  @Input() title = '';
  @Input() data: TreeNode[] = [];
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() errorMessageLink: string | null = null;
  @Input() errorMessageText: string | null = null;
  @Input() createLink?: string;
  @Input() emptyMessage = 'No hay elementos registrados.';
  @Input() selectedId: number | null = null;

  @Output() refresh = new EventEmitter<void>();
  @Output() nodeAction = new EventEmitter<{ type: string; node: TreeNode }>();
  @Output() nodeSelect = new EventEmitter<TreeNode>();

  flatData: FlatTreeNode[] = [];
  readonly expanded = signal<Set<number>>(new Set());
  readonly selected = signal<number | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this.flatData = this.flatten(this.data);
      const validIds = new Set(this.flatData.map(node => node.id));
      this.expanded.update(current => new Set([...current].filter(id => validIds.has(id))));
    }
    if (changes['selectedId']) this.selected.set(this.selectedId);
  }

  toggle(id: number): void {
    const next = new Set(this.expanded());
    next.has(id) ? next.delete(id) : next.add(id);
    this.expanded.set(next);
  }

  isExpanded(id: number): boolean { return this.expanded().has(id); }
  isVisible(node: FlatTreeNode): boolean { return node.ancestor_ids.every(id => this.expanded().has(id)); }

  selectNode(node: FlatTreeNode): void {
    this.selected.set(node.id);
    this.nodeSelect.emit(node);
  }

  flatten(data: TreeNode[], parentId: number | null = null, level = 0, ancestors: number[] = []): FlatTreeNode[] {
    return data.flatMap(node => {
      const flat: FlatTreeNode = { ...node, level, parent_id: parentId, ancestor_ids: ancestors };
      const children = node.children?.length ? this.flatten(node.children, node.id, level + 1, [...ancestors, node.id]) : [];
      return [flat, ...children];
    });
  }

  stateLabel(node: TreeNode): string | null {
    if (node.estado) return node.estado;
    if (node.activo === true) return 'Activo';
    if (node.activo === false) return 'Inactivo';
    return null;
  }

  emitAction(event: Event, type: string, node: TreeNode): void {
    event.stopPropagation();
    this.nodeAction.emit({ type, node });
  }
}
