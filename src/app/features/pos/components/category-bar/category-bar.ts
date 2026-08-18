import { CommonModule } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { Categoria } from '@app/core/models/categoria';

@Component({ selector: 'app-category-bar', standalone: true, imports: [CommonModule], templateUrl: './category-bar.html', styleUrl: './category-bar.css' })
export class CategoryBarComponent {
  categorias = input<Categoria[]>([]);
  selectedCategoryId = input<number | null>(null);
  selectedSubcategoryId = input<number | null>(null);
  isLoading = input(false);
  categorySelected = output<number | null>();
  subcategorySelected = output<number | null>();
  expandedCategoryId = signal<number | null>(null);
  parentCategorias = computed(() => this.categorias().filter(category => !category.parent_id));
  visibleSubcategories = computed(() => this.categorias().find(item => item.id === this.expandedCategoryId())?.children || []);

  onSelectCategory(categoryId: number | null): void {
    this.categorySelected.emit(categoryId);
    this.subcategorySelected.emit(null);
    this.expandedCategoryId.set(categoryId === this.expandedCategoryId() ? null : categoryId);
  }

  trackByCategory = (_: number, category: Categoria): number => category.id;
}
