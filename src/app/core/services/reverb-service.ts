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

    // Log connection state for debugging
    try {
      const pusher = (this.echo as any).connector?.pusher;
      if (pusher) {
        pusher.connection.bind('connected', () => console.log('WebSocket connected'));
        pusher.connection.bind('error', (err: any) => console.warn('WebSocket error', err));
      }
    } catch (e) {
      console.warn('Could not bind pusher connection events', e);
    }
  }
  // Método genérico para escuchar CUALQUIER canal y evento público
  escucharCanal(canal: string, evento: string): Observable<any> {
    return new Observable((subscriber) => {
      try {
        console.log('Subscribing to channel', canal, 'event', evento);
        this.echo.channel(canal).listen(evento, (data: any) => {
          console.log('Event received on', canal, evento, data);
          subscriber.next(data);
        });
      } catch (e) {
        console.warn('Error subscribing to channel', canal, evento, e);
      }

      // Si el componente se destruye, cancelamos la suscripción automáticamente
      return () => {
        this.echo.leaveChannel(canal);
      };
    });
  }
}
