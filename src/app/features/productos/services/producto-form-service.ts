import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ProductoFormService {
  crearFormData(
    formValue: any,
    subcategorias: any[],
    modificadoresSeleccionados: any[],
    esUpdate = false
  ): FormData {

    const formData = new FormData();

    const categoriaIdFinal =
      subcategorias.length > 0
        ? formValue.categoria_id
        : formValue.categoria_principal;

    formData.append('categoria_id', String(categoriaIdFinal));
    formData.append('nombre', formValue.nombre);
    formData.append('descripcion', formValue.descripcion || '');
    formData.append('precio', String(formValue.precio));
    formData.append('activo', formValue.activo ? '1' : '0');
    formData.append('maneja_stock', formValue.maneja_stock ? '1' : '0');

    if (formValue.maneja_stock) {
      formData.append('stock', String(formValue.stock || 0));
      formData.append('stock_minimo', String(formValue.stock_minimo || 0));
    }

    if (formValue.imagen instanceof File) {
      formData.append('imagen', formValue.imagen);
    }

    const opciones: any[] = [];

    modificadoresSeleccionados.forEach((mod: any) => {
      mod.opciones.forEach((opcion: any) => {
        opciones.push({
          id: opcion.id,
          predeterminado: opcion.predeterminado
        });
      });
    });

    opciones.forEach((op, index) => {
      formData.append(
        `opciones[${index}][id]`,
        String(op.id)
      );

      formData.append(
        `opciones[${index}][predeterminado]`,
        op.predeterminado ? '1' : '0'
      );
    });

    if (esUpdate) {
      formData.append('_method', 'PUT');
    }

    return formData;
  }
}
