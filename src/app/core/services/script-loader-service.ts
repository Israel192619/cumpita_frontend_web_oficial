// import { Injectable } from '@angular/core';

// @Injectable({
//   providedIn: 'root',
// })
// export class ScriptLoaderService {
//   loadScript(src: string): Promise<void> {
//     return new Promise((resolve, reject) => {
//       const script = document.createElement('script');
//       script.src = src;
//       script.onload = () => resolve();
//       script.onerror = () => reject(`Error cargando ${src}`);
//       document.body.appendChild(script);
//     });
//   }

//   async loadAll() {
//     const scripts = [
//       '/js/popper.min.js',
//       '/js/simplebar.min.js',
//       '/js/bootstrap.min.js',
//       '/js/pcoded.js',
//       '/js/feather.min.js',
//       '/js/apexcharts.min.js',
//       '/js/dashboard-default.js'
//     ];

//     for (const src of scripts) {
//       await this.loadScript(src);
//     }

//     // 🔹 Ejecutar configuraciones del template
//     if (typeof layout_change === 'function') layout_change('light');
//     if (typeof font_change === 'function') font_change('Roboto');
//     if (typeof change_box_container === 'function') change_box_container('false');
//     if (typeof layout_caption_change === 'function') layout_caption_change('true');
//     if (typeof layout_rtl_change === 'function') layout_rtl_change('false');
//     if (typeof preset_change === 'function') preset_change('preset-1');

//     if (typeof menu_click === 'function') menu_click();
//   }
// }
