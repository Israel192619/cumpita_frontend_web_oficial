// Ejemplo de integración en app.routes.ts

import { Routes } from '@angular/router';
import { PosHome } from '@app/features/pos/pages/pos-home/pos-home';

export const routes: Routes = [
  {
    path: '',
    component: PosHome,
    data: { title: 'POS - Punto de Venta' },
  },
  // ... Otras rutas de la aplicación
];

// ==========================================
// IMPORTANTE: Asegúrate que HttpClientModule está disponible
// ==========================================

// En main.ts o app.config.ts, debe estar:
/*
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    // ... otros providers
  ]
});
*/

// ==========================================
// PRUEBAS MANUALES
// ==========================================

/*
1. Abre http://localhost:4200 (o tu puerto)

2. Verifica que se cargan:
   - Categorías (izquierda)
   - Productos (centro)
   - Carrito vacío (derecha)

3. Pruebas:
   a) Click en categoría → Filtra productos ✓
   b) Click en producto → Se agrega al carrito ✓
   c) Click otra vez en mismo → Aumenta cantidad ✓
   d) Click en - cantidad → Disminuye ✓
   e) Click en X item → Elimina ✓
   f) Total se actualiza automáticamente ✓
   g) Click en COBRAR → Abre modal ✓
   h) Selecciona método pago → Se activa ✓
   i) Rellena datos cliente (opcional) ✓
   j) Click CONFIRMAR VENTA → Crea orden en backend ✓
   k) Carrito se limpia automáticamente ✓

4. En consola del navegador:
   - Verifica que no hay errores
   - Verifica que se hacen HTTP calls correctos
*/

// ==========================================
// DEBUGGING - VERIFICAR SIGNALS
// ==========================================

/*
En el componente PosHome, agregar en ngOnInit():

effect(() => {
  console.log('🔄 Categorías:', this.categorias());
  console.log('🔄 Productos:', this.productos());
  console.log('🛒 Carrito:', this.carrito());
  console.log('💰 Total:', this.total());
});

Esto muestra los cambios en tiempo real en la consola.
*/

// ==========================================
// PERSONALIZACIÓN
// ==========================================

/*
Para ajustar según tus necesidades:

1. Cambiar colores primarios:
   - Editar CSS: --color-primary: #007bff
   - En cada componente .css

2. Agregar impuestos:
   - En pos.service.ts interface Order
   - En PosHome.total computed

3. Cambiar métodos de pago:
   - En checkout-modal.ts paymentMethods array

4. Agregar logo/header:
   - Editar pos-home.html

5. Cambiar formato de precios:
   - Locale en formatPrice() métodos
   - Cambiar 'es-ES' si es necesario
   - Cambiar la moneda desde `core/config/currency.config.ts`
*/
