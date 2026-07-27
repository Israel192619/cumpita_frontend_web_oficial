import { Component, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProductoService } from '../../services/producto-service';
import { CategoriaService } from '../../../categorias/services/categoria-service';
import { ModificadorService, Modificador } from '../../../modificadores/services/modificador-service';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { FormCard, InputForm, Select, ErrorMessage } from '../../../../shared/components';
import { CommonModule } from '@angular/common';
import { Categoria } from '../../../../core/models/categoria';
import { ProductoFormService } from '../../services/producto-form-service';
import { EstacionTrabajoService } from '../../../estaciones/services/estacion-trabajo-service';

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
  selector: 'app-producto-create',
  imports: [
    FormCard, InputForm, Select, ErrorMessage, ReactiveFormsModule, CommonModule
  ],
  templateUrl: './producto-create.html',
  styleUrl: './producto-create.css',
})
export class ProductoCreate {
  form: FormGroup;
  error = signal<string | null>(null);
  isloading = signal(false);

  categorias = signal<{ label: string; value: number }[]>([]);
  subcategorias = signal<{ label: string; value: number }[]>([]);
  categoriaSeleccionada = signal<number | null>(null);
  modificadores = signal<Modificador[]>([]);
  modificadoresSeleccionados = signal<ModificadorSeleccionado[]>([]);
  estaciones = signal<{ label: string; value: number }[]>([]);

  constructor(
    private fb: FormBuilder,
    private productoService: ProductoService,
    private categoriaService: CategoriaService,
    private modificadorService: ModificadorService,
    private toastr: ToastrService,
    private productoFormService: ProductoFormService,
    private estacionTrabajoService: EstacionTrabajoService,
    private router: Router
  ) {
    this.form = this.fb.group({
      categoria_principal: [null, Validators.required],
      categoria_id: [null],
      estacion_id: [null],
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
    this.isloading.set(false);
    this.cargarCategoriasPrincipales();
    this.cargarModificadores();
    this.cargarEstaciones();
    
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

  cargarEstaciones() {
    this.estacionTrabajoService.listar().subscribe({
      next: (estaciones) => this.estaciones.set(
        estaciones.filter(estacion => estacion.activa)
          .map(estacion => ({ label: `${estacion.nombre} (${estacion.codigo})`, value: estacion.id }))
      ),
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

  crearProducto() {
    this.guardarProducto(() => {
      this.router.navigate(['/app/productos']);
    });
  }

  cancelar() {
    this.router.navigate(['/app/productos']);
  }

  private guardarProducto(onSuccess: () => void) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.isloading.set(true);

    // const formData = this.productoFormService.crearFormData(
    //   this.form.value,
    //   this.subcategorias(),
    //   this.modificadoresSeleccionados()
    // );
    const formData = new FormData();
    const formValue = this.form.value;

    const categoriaIdFinal =
    this.subcategorias().length > 0
      ? formValue.categoria_id
      : formValue.categoria_principal;
    formData.append('categoria_id', categoriaIdFinal);
    formData.append('estacion_id', formValue.estacion_id);
    formData.append('nombre', formValue.nombre);
    formData.append('descripcion', formValue.descripcion || '');
    formData.append('precio', formValue.precio);
    formData.append('activo', formValue.activo ? '1' : '0');
    formData.append('maneja_stock', formValue.maneja_stock ? '1' : '0');

    if (formValue.maneja_stock) {
      formData.append('stock', formValue.stock || 0);
      formData.append('stock_minimo', formValue.stock_minimo || 0);
    }

    if (formValue.imagen) {
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

    this.productoService.crearProducto(formData).subscribe({
      next: () => {
        this.toastr.success('Producto creado correctamente');
        this.error.set(null);
        this.isloading.set(false);
        onSuccess();
      }
    });
  }

  getControl(name: string): FormControl {
    return this.form.get(name) as FormControl;
  }
}

