import { ApplicationConfig, importProvidersFrom, LOCALE_ID, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsBo from '@angular/common/locales/es-BO';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { jwtInterceptor } from './core/interceptors/jwt-interceptor';
import { authInterceptor } from './core/interceptors/auth-interceptor';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { errorInterceptor } from './core/interceptors/error-interceptor';
import { provideServiceWorker } from '@angular/service-worker';

registerLocaleData(localeEsBo);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: LOCALE_ID, useValue: 'es-BO' },
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([jwtInterceptor, authInterceptor, errorInterceptor])
    ),
    provideAnimations(),
    provideToastr(),
    importProvidersFrom(
      MatDialogModule,
      MatButtonModule
    ),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
