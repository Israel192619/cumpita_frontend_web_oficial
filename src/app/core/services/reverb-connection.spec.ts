import { reverbConnection } from './reverb-connection';

describe('Conexión de eventos del POS', () => {
  it('usa el proxy del servidor de desarrollo desde localhost', () => {
    expect(reverbConnection({ hostname: 'localhost', protocol: 'http:', port: '4200' })).toEqual({
      wsHost: 'localhost', wsPort: 4200, wssPort: 443, forceTLS: false,
    });
  });

  it('usa el mismo proxy desde una tablet o teléfono de la red', () => {
    expect(reverbConnection({ hostname: '192.168.1.16', protocol: 'http:', port: '4200' })).toEqual({
      wsHost: '192.168.1.16', wsPort: 4200, wssPort: 443, forceTLS: false,
    });
  });

  it('mantiene HTTPS en el dominio publicado', () => {
    expect(reverbConnection({ hostname: 'tonito.local', protocol: 'https:', port: '' })).toEqual({
      wsHost: 'tonito.local', wsPort: 443, wssPort: 443, forceTLS: true,
    });
  });

  it('conserva localhost para su certificado HTTPS', () => {
    expect(reverbConnection({ hostname: 'localhost', protocol: 'https:', port: '' }).wsHost).toBe('localhost');
  });

  it('mantiene el acceso HTTPS por la dirección de la red', () => {
    expect(reverbConnection({ hostname: '192.168.3.20', protocol: 'https:', port: '' })).toEqual({
      wsHost: '192.168.3.20', wsPort: 443, wssPort: 443, forceTLS: true,
    });
  });
});
