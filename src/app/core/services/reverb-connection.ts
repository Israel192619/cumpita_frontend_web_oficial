export function reverbConnection(location: Pick<Location, 'hostname' | 'protocol' | 'port'>) {
  const secure = location.protocol === 'https:';
  return {
    wsHost: location.hostname,
    wsPort: secure ? 443 : Number(location.port || 80),
    wssPort: 443,
    forceTLS: secure,
  };
}
