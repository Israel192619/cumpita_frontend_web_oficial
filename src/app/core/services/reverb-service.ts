import { Injectable } from '@angular/core';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { Observable } from 'rxjs';
import { reverbConnection } from './reverb-connection';
(window as any).Pusher = Pusher;

@Injectable({
  providedIn: 'root',
})
export class ReverbService {
  private echo: Echo<any>;
  private readonly suscriptoresPorCanal = new Map<string, number>();

  constructor() {
    this.echo = new Echo({
      broadcaster: 'reverb',
      key: '6x0supev9eq3anpkyr8s',
      ...reverbConnection(window.location),
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
      const recibir = (data: any) => {
        console.log('Event received on', canal, evento, data);
        subscriber.next(data);
      };
      let escuchando = false;
      try {
        console.log('Subscribing to channel', canal, 'event', evento);
        this.echo.channel(canal).listen(evento, recibir);
        this.suscriptoresPorCanal.set(canal, (this.suscriptoresPorCanal.get(canal) ?? 0) + 1);
        escuchando = true;
      } catch (e) {
        console.warn('Error subscribing to channel', canal, evento, e);
      }

      return () => {
        if (!escuchando) return;
        this.echo.channel(canal).stopListening(evento, recibir);
        const restantes = (this.suscriptoresPorCanal.get(canal) ?? 1) - 1;
        if (restantes > 0) this.suscriptoresPorCanal.set(canal, restantes);
        else {
          this.suscriptoresPorCanal.delete(canal);
          this.echo.leaveChannel(canal);
        }
      };
    });
  }
}
