import { Injectable } from '@angular/core';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { Observable } from 'rxjs';
(window as any).Pusher = Pusher;

@Injectable({
  providedIn: 'root',
})
export class ReverbService {
  private echo: Echo<any>;

  constructor() {
    this.echo = new Echo({
      broadcaster: 'reverb',
      key: '6x0supev9eq3anpkyr8s',
      wsHost: '127.0.0.1',
      wsPort: 8080,
      forceTLS: false,
      enabledTransports: ['ws', 'wss']
    });
  }
  // Método genérico para escuchar CUALQUIER canal y evento público
  escucharCanal(canal: string, evento: string): Observable<any> {
    return new Observable((subscriber) => {
      this.echo.channel(canal).listen(evento, (data: any) => {
        subscriber.next(data);
      });

      // Si el componente se destruye, cancelamos la suscripción automáticamente
      return () => {
        this.echo.leaveChannel(canal);
      };
    });
  }
}
