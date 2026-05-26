# Button Component - Guía de Uso

Botón global reutilizable con soporte para colores, tamaños, estados de loading, deshabilitación y redirección.

## Propiedades

| Propiedad | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `text` | `string` | `'Button'` | Texto del botón |
| `color` | `ButtonColor` | `'primary'` | Color: `primary`, `secondary`, `success`, `danger`, `warning`, `info`, `light`, `dark` |
| `size` | `ButtonSize` | `'medium'` | Tamaño: `small`, `medium`, `large` |
| `loading` | `boolean` | `false` | Muestra loader y deshabilita el botón |
| `disabled` | `boolean` | `false` | Deshabilita el botón |
| `link` | `string \| null` | `null` | Link de redirección (si se proporciona, se convierte en `<a>`) |
| `type` | `ButtonType` | `'button'` | Tipo: `button`, `submit`, `reset` |

## Eventos

| Evento | Tipo | Descripción |
|--------|------|-------------|
| `click` | `EventEmitter<void>` | Se emite al hacer click (si no está loading o disabled) |

## Ejemplos de Uso

### Botón Básico
```html
<app-button 
  text="Guardar" 
  (click)="guardar()">
</app-button>
```

### Botón con Color
```html
<app-button 
  text="Eliminar" 
  color="danger"
  (click)="eliminar()">
</app-button>
```

### Botón con Tamaño
```html
<app-button 
  text="Crear" 
  size="large"
  color="success"
  (click)="crear()">
</app-button>
```

### Botón con Loading
```html
<app-button 
  text="Procesando..." 
  [loading]="isLoading"
  color="primary"
  (click)="procesar()">
</app-button>
```

### Botón con Link de Redirección
```html
<app-button 
  text="Ver Usuarios" 
  link="/app/users/list"
  color="info">
</app-button>
```

### Botón en Formulario
```html
<app-button 
  text="Enviar" 
  type="submit"
  [loading]="isSubmitting"
  [disabled]="form.invalid">
</app-button>
```

### Botón Deshabilitado
```html
<app-button 
  text="Deshabilitado" 
  disabled="true"
  color="secondary">
</app-button>
```

### Ejemplo Completo en Componente

**TypeScript:**
```typescript
export class MyComponent {
  isLoading = false;

  guardar() {
    this.isLoading = true;
    this.service.guardar().subscribe({
      next: () => {
        this.isLoading = false;
        // éxito
      },
      error: () => {
        this.isLoading = false;
        // error
      }
    });
  }
}
```

**Template:**
```html
<div>
  <app-button 
    text="Guardar" 
    color="primary"
    size="large"
    [loading]="isLoading"
    (click)="guardar()">
  </app-button>
  
  <app-button 
    text="Cancelar" 
    link="/app/panel"
    color="light"
    size="large">
  </app-button>
</div>
```

## Colores Disponibles

- **primary** - Azul (por defecto)
- **secondary** - Gris
- **success** - Verde
- **danger** - Rojo
- **warning** - Amarillo
- **info** - Cian
- **light** - Gris claro
- **dark** - Gris oscuro

## Comportamiento

1. El botón muestra un **loader animado** cuando `loading = true`
2. Cuando está cargando, el botón se **deshabilita automáticamente**
3. El texto se vuelve semi-transparente durante la carga
4. Si se proporciona un `link`, se convierte en un elemento `<a>` en lugar de `<button>`
5. En estado loading o disabled, los eventos de click no se emiten
6. El loader utiliza la misma animación que el componente `Loader` pero adaptada al botón
