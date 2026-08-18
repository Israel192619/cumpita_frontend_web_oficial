# POS Home - Sistema de Punto de Venta Profesional

## 📋 Descripción General

POS Home es una interfaz moderna y profesional de punto de venta diseñada para restaurantes. Implementada en Angular con un diseño táctil-optimizado, layout de 3 columnas y estado reactivo con Signals.

## 🏗️ Arquitectura

### Estructura de Carpetas

```
features/pos/
├── components/
│   ├── category-bar/        # Selector de categorías (lateral)
│   ├── product-grid/        # Grid de productos (centro)
│   ├── cart-panel/          # Panel de carrito (derecha)
│   ├── checkout-modal/      # Modal de pago
│   └── index.ts             # Exportaciones
├── pages/
│   └── pos-home/            # Componente principal orquestador
├── services/
│   ├── pos.service.ts       # Lógica HTTP y tipos
│   └── index.ts             # Exportaciones
└── README.md                # Este archivo
```

### Componentes

#### **1. PosHome (Orquestador Principal)**
- Gestiona todo el estado con Signals
- Orquesta la comunicación entre componentes
- Maneja HTTP calls y lógica de negocio
- Archivo: `pages/pos-home/pos-home.ts`

#### **2. CategoryBar (Categorías)**
- Lista horizontal/vertical de categorías
- Selector dinámico: "Todos" + categorías
- Click filtra productos
- Archivo: `components/category-bar/`

#### **3. ProductGrid (Productos)**
- Grid responsivo de productos
- Imagen, nombre, precio
- Indicador de disponibilidad/stock
- Click agrega al carrito
- Archivo: `components/product-grid/`

#### **4. CartPanel (Carrito)**
- Panel lateral derecho
- Lista de items agregados
- Controles: +/- cantidad, eliminar
- Totales en tiempo real
- Botón "Cobrar"
- Archivo: `components/cart-panel/`

#### **5. CheckoutModal (Pago)**
- Modal de confirmación
- Resumen de compra
- Selección de método de pago (3 opciones)
- Datos de cliente (opcional)
- Confirmación final
- Archivo: `components/checkout-modal/`

## 🎯 Flujo de Uso

```
1. Usuario abre POS Home
   ↓
2. Se cargan categorías y productos
   ↓
3. Usuario selecciona categoría (opcional)
   ↓
4. Productos se filtran/cargan
   ↓
5. Usuario hace click en producto
   ↓
6. Producto se agrega al carrito (si ya existe, aumenta cantidad)
   ↓
7. Se actualiza total automáticamente (Signals computed)
   ↓
8. Usuario puede:
   - Aumentar/disminuir cantidad
   - Eliminar producto
   - Agregar más productos
   ↓
9. Usuario hace click en "COBRAR"
   ↓
10. Modal de pago se abre
    ↓
11. Usuario selecciona método pago + datos cliente
    ↓
12. Usuario confirma
    ↓
13. Order se crea en backend
    ↓
14. Carrito se limpia
    ↓
15. Pantalla lista para nueva venta
```

## 🔄 Estado Reactivo (Signals)

### Signals Principales

```typescript
// Datos
categorias = signal<Categoria[]>([])
productos = signal<Producto[]>([])
carrito = signal<CartItem[]>([])
selectedCategoryId = signal<number | null>(null)

// Estados de carga
isLoadingCategorias = signal<boolean>(true)
isLoadingProductos = signal<boolean>(false)
isCheckoutModalOpen = signal<boolean>(false)
isProcessingCheckout = signal<boolean>(false)
error = signal<string | null>(null)

// Computed (valores derivados)
subtotal = computed(() => { /* suma carrito */ })
total = computed(() => { /* subtotal + impuestos */ })
cartItemCount = computed(() => { /* cantidad total items */ })
```

### Ventajas de Signals

- ✅ Reactividad automática
- ✅ Sin memory leaks
- ✅ Performance optimizado
- ✅ Código limpio y declarativo
- ✅ Mejor que RxJS para estado UI simple

## 📡 Servicio POS (pos.service.ts)

### Métodos HTTP

```typescript
// Categorías
obtenerCategorias(): Observable<Categoria[]>

// Productos
obtenerProductos(categoriaId?: number): Observable<Producto[]>
obtenerProducto(id: number): Observable<Producto>

// Órdenes
crearOrden(order: Order): Observable<Order>
obtenerOrdenes(): Observable<Order[]>

// Métodos de pago
obtenerMetodosPago(): Observable<PaymentMethod[]>

// Clientes
buscarClientes(query: string): Observable<any[]>
```

### Interfaces Principales

```typescript
// Item en el carrito
interface CartItem {
  id: number                          // ID único temporal
  producto: Producto                  // Producto completo
  cantidad: number                    // Cantidad seleccionada
  precio_unitario: number             // Precio base
  subtotal: number                    // cantidad * precio
  modificadores?: CartItemModificador[] // Adicionales
}

// Orden a enviar a backend
interface Order {
  id: number
  numero_orden?: string
  cliente_nombre?: string
  cliente_telefono?: string
  items: CartItem[]
  subtotal: number
  impuesto?: number
  descuento?: number
  total: number
  metodo_pago: 'efectivo' | 'qr' | 'tarjeta'
  estado?: string
  created_at?: string
}

// Método de pago
interface PaymentMethod {
  id: string
  nombre: string
  icon?: string
}
```

## 🎨 Diseño y Estilos

### Paleta de Colores

- **Primario**: `#007bff` (Azul - Botones, highlights)
- **Éxito**: `#28a745` (Verde - Botón Cobrar)
- **Error**: `#ff4757` / `#dc3545` (Rojo - Eliminar, errores)
- **Neutro**: `#f5f5f5`, `#e0e0e0`, `#999` (Grises)

### Layout

- **Izquierda**: Categorías (150px ancho)
- **Centro**: Productos (flex, grid responsivo)
- **Derecha**: Carrito (350px ancho)
- **Total Height**: 100vh (fullscreen)

### Responsive

- **Desktop**: 3 columnas (categorías | productos | carrito)
- **Tablet**: Ajusta anchos, mantiene 3 columnas
- **Mobile**: Oculta categorías, carrito full-width (requiere refinamiento)

### Touch Optimization

- Botones mín. 48x48px en modo táctil
- Espaciado generoso entre elementos
- Bordes redondeados para feel moderno
- Animaciones suaves

## 🚀 Features Implementados

### ✅ Implementados

- [x] Grid de productos responsivo
- [x] Selector de categorías con filtrado
- [x] Carrito con +/- cantidad
- [x] Eliminar items del carrito
- [x] Totales en tiempo real (Signals computed)
- [x] Modal de pago con 3 métodos
- [x] Datos de cliente (opcional)
- [x] Creación de órdenes HTTP
- [x] Limpieza de carrito post-venta
- [x] Manejo de errores
- [x] Loading states
- [x] Indicadores de stock/disponibilidad
- [x] Imágenes de productos
- [x] Descripción de productos

### 🔜 Por Implementar (Optional)

- [ ] Selección de modificadores por producto
- [ ] Descuentos y cupones
- [ ] Historial de órdenes del día
- [ ] Búsqueda de productos
- [ ] Impresora de recibos
- [ ] Caja rápida (ctrl+mayús para agregar)
- [ ] Estadísticas en tiempo real
- [ ] Dark mode
- [ ] Sincronización offline
- [ ] Autocompletado de clientes
- [ ] Split payment
- [ ] Propina

## 🔧 Instalación y Uso

### 1. Asegúrate de que el backend está disponible

Backend esperado en `/api`:
- `GET /categorias`
- `GET /productos?categoria_id=X` (opcional query param)
- `POST /ordenes` (crear orden)
- etc...

### 2. Importa en tu app.routes.ts

```typescript
import { PosHome } from '@app/features/pos/pages/pos-home/pos-home';

export const routes: Routes = [
  {
    path: 'pos',
    component: PosHome,
  },
  // ... otras rutas
];
```

### 3. Asegúrate que HttpClientModule esté disponible

En tu main.ts o app.config.ts:

```typescript
import { HttpClientModule } from '@angular/common/http';

bootstrapApplication(AppComponent, {
  providers: [
    HttpClientModule,
    // ... otros providers
  ]
});
```

## 📊 Flujo de Estado

```
┌─────────────────────────────────────┐
│      PosHome Component (Main)       │
│  (Signals, Computed, Http calls)    │
└──────┬──────────────────────────────┘
       │
       ├─────────────────────────────────────────────┐
       │                                             │
       ▼                                             ▼
┌──────────────────┐                      ┌──────────────────┐
│  CategoryBar     │                      │  ProductGrid     │
│  (Inputs/Output) │                      │  (Inputs/Output) │
└──────────────────┘                      └──────────────────┘
       │                                             │
       └─────────────┬───────────────────────────────┘
                     │
                     ▼
            ┌────────────────────┐
            │   PosService       │
            │ (HTTP, Interfaces) │
            └────────────────────┘
                     │
                     ▼
              ┌──────────────┐
              │   Backend    │
              │   Laravel    │
              └──────────────┘

┌────────────────────────────┐
│     CartPanel              │
│  (Totales reactivos)       │
└────────────────────────────┘
         │
         ▼
┌────────────────────────────┐
│  CheckoutModal             │
│  (Confirmación pago)       │
└────────────────────────────┘
```

## 🐛 Debugging

### Signals: Mostrar valores en consola

```typescript
effect(() => {
  console.log('Carrito actualizado:', this.carrito());
  console.log('Total:', this.total());
});
```

### HTTP Calls: Ver requests/responses

```typescript
// En PosService, agregar logging:
obtenerProductos(categoriaId?: number): Observable<Producto[]> {
  const params = categoriaId ? `?categoria_id=${categoriaId}` : '';
  return this.http.get<Producto[]>(`${this.apiUrl}/productos${params}`)
    .pipe(
      tap(resp => console.log('✓ Productos:', resp)),
      catchError(err => {
        console.error('✗ Error productos:', err);
        throw err;
      })
    );
}
```

## 📝 Notas Importantes

1. **IDs Temporales**: Los items del carrito usan `Date.now()` como ID temporal. El backend debe ignorar esto y generar sus propios IDs.

2. **Subtotal en CartItem**: Se recalcula automáticamente en `onQuantityChanged`. No depende de computed porque puede tener modificadores.

3. **Modificadores**: La estructura soporta modificadores pero su selección debe implementarse como feature adicional.

4. **Stock**: Si el producto `maneja_stock`, se valida disponibilidad antes de permitir agregar.

5. **Imágenes**: Usa `imagen_url` del producto. Fallback a `/images/no-image.png`.

6. **Formatos de Precio**: Usa la configuración y el formateador central de `core/config/currency.config.ts`.

7. **Error Handling**: Usa la propiedad `error` signal para mostrar errores. El banner de error es dismissible.

## 🎯 Performance

- **Grid de productos**: Usa `trackBy` para optimizar change detection
- **Signals**: No dispara change detection en toda la app, solo componentes suscritos
- **Computed**: Re-calcula solo cuando sus dependencias cambian
- **OnPush Change Detection**: Recomendado agregar a componentes para más performance

## 📞 Soporte

Para dudas o mejoras, contacta al equipo de desarrollo.
