import { resolveApiAssetUrl } from './asset-url';

describe('Direcciones de archivos de la API', () => {
  it('dirige los archivos storage al servidor de la API', () => {
    expect(resolveApiAssetUrl('/storage/modificadores/opciones/ala.jpg'))
      .toBe('http://192.168.1.16:8000/storage/modificadores/opciones/ala.jpg');
  });

  it('conserva direcciones absolutas y recursos del frontend', () => {
    expect(resolveApiAssetUrl('https://cdn.example.com/ala.jpg')).toBe('https://cdn.example.com/ala.jpg');
    expect(resolveApiAssetUrl('/images/no-image.png')).toBe('/images/no-image.png');
  });
});
