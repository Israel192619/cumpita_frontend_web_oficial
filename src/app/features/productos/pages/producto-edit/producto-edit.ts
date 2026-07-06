import { Component, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductoService } from '../../services/producto-service';
import { CategoriaService } from '../../../categorias/services/categoria-service';
import { ModificadorService, Modificador } from '../../../modificadores/services/modificador-service';
import { ToastrService } from 'ngx-toastr';
import { FormCard, InputForm, Select, ErrorMessage } from '../../../../shared/components';
import { CommonModule } from '@angular/common';
import { Categoria } from '../../../../core/models/categoria';
import { Producto } from '../../../../core/models/producto';

interface OpcionSeleccionada {
  id: number;
  nombre: string;
  precio_extra: number;
  predeterminado: boolean;
}

interface ModificadorSeleccionado {
  modificador_id: number;
  nombre: string;
  opciones: OpcionSeleccionada[];
}

@Component({
  selector: 'app-producto-edit',
  imports: [
    FormCard, InputForm, Select, ErrorMessage, ReactiveFormsModule, CommonModule
  ],
  templateUrl: './producto-edit.html',
  styleUrl: './producto-edit.css',
})
export class ProductoEdit {
  form: FormGroup;
  error = signal<string | null>(null);
  loading = signal(false);
  productId = signal<number | null>(null);

  categorias = signal<{ label: string; value: number }[]>([]);
  subcategorias = signal<{ label: string; value: number }[]>([]);
  categoriaSeleccionada = signal<number | null>(null);
  modificadores = signal<Modificador[]>([]);
  producto = signal<Producto | null>(null);
  modificadoresSeleccionados = signal<ModificadorSeleccionado[]>([]);

  constructor(
    private fb: FormBuilder,
    private productoService: ProductoService,
    private categoriaService: CategoriaService,
    private modificadorService: ModificadorService,
    private route: ActivatedRoute,
    private toastr: ToastrService,
    private router: Router
  ) {
    this.form = this.fb.group({
      categoria_principal: [null, Validators.required],
      categoria_id: [null, Validators.required],
      nombre: ['', Validators.required],
      descripcion: [''],
      precio: [0, [Validators.required, Validators.min(0)]],
      activo: [true],
      maneja_stock: [false],
      stock: [null],
      stock_minimo: [null],
      imagen: [null]
    });
  }

  ngOnInit() {
    this.error.set(null);
    this.loading.set(false);
    
    this.route.params.subscribe(params => {
      const id = parseInt(params['id']);
      if (id) {
        this.productId.set(id);
        this.cargarCategoriasPrincipales();
        this.cargarModificadores();
        this.cargarProducto(id);
      }
    });

    // Cuando se selecciona una categoría principal, cargar subcategorías
    this.form.get('categoria_principal')?.valueChanges.subscribe(val => {
      this.form.get('categoria_id')?.reset();
      if (val) {
        this.cargarSubcategorias(val);
      } else {
        this.subcategorias.set([]);
      }
    });

    // Validar stock cuando maneja_stock cambia
    this.form.get('maneja_stock')?.valueChanges.subscribe(val => {
      const stockCtrl = this.form.get('stock');
      const stockMinCtrl = this.form.get('stock_minimo');
      if (val) {
        stockCtrl?.setValidators([Validators.required, Validators.min(0)]);
        stockMinCtrl?.setValidators([Validators.required, Validators.min(0)]);
      } else {
        stockCtrl?.clearValidators();
        stockMinCtrl?.clearValidators();
      }
      stockCtrl?.updateValueAndValidity();
      stockMinCtrl?.updateValueAndValidity();
    });
  }

  cargarCategoriasPrincipales() {
    this.categoriaService.listarCategorias().subscribe({
      next: (todas) => {
        // Filtrar solo categorías sin parent_id (categorías principales)
        const principales = todas.filter(c => !c.parent_id);
        this.categorias.set(
          principales.map(c => ({ label: c.nombre, value: c.id }))
        );
      }
    });
  }

  cargarSubcategorias(categoriaPrincipalId: number) {
    this.categoriaService.getCategoriaPorId(categoriaPrincipalId).subscribe({
      next: (categoria) => {
        const subcategorias = (categoria.children ?? []).map(subcategoria => ({
          label: subcategoria.nombre,
          value: subcategoria.id
        }));

        this.subcategorias.set(subcategorias);
        const categoriaIdControl = this.getControl('categoria_id');
        if (subcategorias.length > 0) {

          categoriaIdControl.setValidators([
            Validators.required
          ]);

        } else {

          categoriaIdControl.clearValidators();
          categoriaIdControl.setValue(null);
        }
      }
    });
  }

  cargarModificadores() {
    this.modificadorService.listarModificadores().subscribe({
      next: (modificadores) => {
        this.modificadores.set(modificadores);
      }
    });
  }

  cargarProducto(id: number) {
    this.loading.set(true);
    this.productoService.obtenerProducto(id).subscribe({
      next: (producto) => {
        this.producto.set(producto);
        // Cargar todas las categorías para encontrar la padre
        this.categoriaService.getCategoriaPorId(producto.categoria_id).subscribe({
          next: (categoria) => {
            // Encontrar la categoría del producto
            const categoriaPrincipalId = categoria.parent_id || categoria.id;

            if (categoria.parent_id) {
              this.cargarSubcategorias(categoriaPrincipalId);
            }

            // Patchear el formulario
            this.form.patchValue({
              categoria_principal: categoriaPrincipalId,
              categoria_id: producto.categoria_id,
              nombre: producto.nombre,
              descripcion: producto.descripcion,
              precio: producto.precio,
              activo: producto.activo,
              maneja_stock: producto.maneja_stock,
              stock: producto.stock,
              stock_minimo: producto.stock_minimo
            });

            // Cargar modificadores seleccionados con opciones
            if (producto.modificadores && producto.modificadores.length > 0) {
              const modsSeleccionados: ModificadorSeleccionado[] = [];
              
              producto.modificadores.forEach(modProd => {
                const modificador = this.modificadores().find(m => m.id === modProd.id);
                if (modificador) {
                  const opcionesDelModificador: OpcionSeleccionada[] = (modificador.opciones || []).map(op => {
                    const estaPredeterminada = modProd.opciones?.some(
                      (o: any) => o.id === op.id && o.predeterminado
                    ) ?? false;
                    return {
                      id: op.id || 0,
                      nombre: op.nombre,
                      precio_extra: op.precio_extra,
                      predeterminado: estaPredeterminada
                    };
                  });

                  modsSeleccionados.push({
                    modificador_id: modificador.id,
                    nombre: modificador.nombre,
                    opciones: opcionesDelModificador
                  });
                }
              });

              this.modificadoresSeleccionados.set(modsSeleccionados);
            }

            this.loading.set(false);
          }
        });
      },
      error: () => {
        this.error.set('Error al cargar el producto');
        this.loading.set(false);
      }
    });
  }

  agregarModificador(modificadorId: any) {
    if (!modificadorId) return;
    
    const id = parseInt(modificadorId);
    const modificador = this.modificadores().find(m => m.id === id);
    if (!modificador) return;

    const yaExiste = this.modificadoresSeleccionados().some(m => m.modificador_id === id);
    if (yaExiste) {
      this.error.set('Este modificador ya está agregado');
      return;
    }

    const opcionesDelModificador: OpcionSeleccionada[] = (modificador.opciones || []).map(op => ({
      id: op.id || 0,
      nombre: op.nombre,
      precio_extra: op.precio_extra,
      predeterminado: false
    }));

    this.modificadoresSeleccionados.update(mods => [
      ...mods,
      {
        modificador_id: id,
        nombre: modificador.nombre,
        opciones: opcionesDelModificador
      }
    ]);

    this.error.set(null);
  }

  eliminarModificador(modificadorId: number) {
    this.modificadoresSeleccionados.update(mods =>
      mods.filter(m => m.modificador_id !== modificadorId)
    );
  }

  toggleOpcion(modificadorId: number, opcionId: number) {
    this.modificadoresSeleccionados.update(mods =>
      mods.map(m => {
        if (m.modificador_id === modificadorId) {
          return {
            ...m,
            opciones: m.opciones.map(o => 
              o.id === opcionId ? { ...o, predeterminado: !o.predeterminado } : o
            )
          };
        }
        return m;
      })
    );
  }

  private guardarProductoLogic(onSuccess: () => void) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const productId = this.productId();
    if (!productId) return;

    this.error.set(null);
    this.loading.set(true);

    const formData = new FormData();
    const formValue = this.form.value;

    const categoriaIdFinal =
    this.subcategorias().length > 0
      ? formValue.categoria_id
      : formValue.categoria_principal;
    formData.append('categoria_id', categoriaIdFinal);
    formData.append('nombre', formValue.nombre);
    formData.append('descripcion', formValue.descripcion || '');
    formData.append('precio', formValue.precio);
    formData.append('activo', formValue.activo ? '1' : '0');
    formData.append('maneja_stock', formValue.maneja_stock ? '1' : '0');
    
    if (formValue.maneja_stock) {
      formData.append('stock', formValue.stock || 0);
      formData.append('stock_minimo', formValue.stock_minimo || 0);
    }

    if (formValue.imagen instanceof File) {
      formData.append('imagen', formValue.imagen);
    }

    // Agregar opciones seleccionadas
    const opciones: any[] = [];
    this.modificadoresSeleccionados().forEach(mod => {
      mod.opciones.forEach(opcion => {
        opciones.push({
          id: opcion.id,
          predeterminado: opcion.predeterminado
        });
      });
    });

    if (opciones.length > 0) {
      opciones.forEach((op, index) => {
        formData.append(`opciones[${index}][id]`, String(op.id));
        formData.append(`opciones[${index}][predeterminado]`, op.predeterminado ? '1' : '0');
      });
    }

    formData.append('_method', 'PUT');

    this.productoService.actualizarProducto(productId, formData).subscribe({
      next: () => {
        this.toastr.success('Producto actualizado correctamente');
        this.error.set(null);
        this.loading.set(false);
        onSuccess();
      }
    });
  }

  guardarProducto() {
    this.guardarProductoLogic(() => {
      this.router.navigate(['/app/productos']);
    });
  }

  cancelar() {
    this.router.navigate(['/app/productos']);
  }

  getControl(name: string): FormControl {
    return this.form.get(name) as FormControl;
  }
}
