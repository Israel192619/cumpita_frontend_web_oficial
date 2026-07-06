import { Component, input, output, effect, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Categoria } from '@app/core/models/categoria';
import { Button } from '@app/shared/components/button/button';

@Component({
  selector: 'app-category-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, Button],
  templateUrl: './category-bar.html',
  styleUrl: './category-bar.css',
})
export class CategoryBarComponent implements OnInit {
  categorias = input<Categoria[]>([]);
  selectedCategoryId = input<number | null>(null);
  selectedSubcategoryId = input<number | null>(null);
  isLoading = input<boolean>(false);

  categorySelected = output<number | null>();
  subcategorySelected = output<number | null>();

  expandedCategoryId = signal<number | null>(null);
  searchQuery = signal<string>('');
  currentDate = signal<Date>(new Date());

  // Categorías padre (sin parent_id)
  parentCategorias = computed(() => {
    return this.categorias().filter(cat => !cat.parent_id);
  });

  // Subcategorías visibles de la categoría expandida
  visibleSubcategories = computed(() => {
    if (!this.expandedCategoryId()) return [];
    const parentCat = this.categorias().find(cat => cat.id === this.expandedCategoryId());
    return parentCat?.children || [];
  });

  // Verificar si hay subcategorías visibles
  hasVisibleSubcategories = computed(() => {
    return this.visibleSubcategories().length > 0;
  });

  // Subcategorías de la categoría seleccionada
  selectedCategorySubcategorias = computed(() => {
    if (!this.selectedCategoryId()) return [];
    return this.categorias().filter(cat => cat.parent_id === this.selectedCategoryId());
  });

  ngOnInit(): void {
    // Actualizar fecha actual cada minuto
    setInterval(() => {
      this.currentDate.set(new Date());
    }, 60000);
  }

  onSelectCategory(categoryId: number | null): void {
    this.categorySelected.emit(categoryId);
    this.subcategorySelected.emit(null); // Resetear subcategoría
    
    // Alternar expansión de subcategorías
    if (categoryId === this.expandedCategoryId()) {
      this.expandedCategoryId.set(null);
    } else {
      this.expandedCategoryId.set(categoryId);
    }
  }

  onSelectSubcategory(subcategoryId: number): void {
    this.subcategorySelected.emit(subcategoryId);
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    // TODO: Implementar filtrado de productos por búsqueda
  }

  trackByCategory = (index: number, cat: Categoria) => cat.id;
}
