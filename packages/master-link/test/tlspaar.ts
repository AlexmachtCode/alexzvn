import { connect, createServer, type TLSSocket } from 'node:tls';
import type { AddressInfo } from 'node:net';
import type { TestZertifikat } from './zertifikate';

/** Ein verbundenes TLS-Paar auf 127.0.0.1 (Client ohne Pin — nur für Rahmen-Tests). */
export async function tlsPaar(z: TestZertifikat): Promise<{ server: TLSSocket; client: TLSSocket; schliesse(): void }> {
  const srv = createServer({ key: z.key, cert: z.cert });
  const serverSeite = new Promise<TLSSocket>((r) => srv.once('secureConnection', r));
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const port = (srv.address() as AddressInfo).port;
  const client = connect({ host: '127.0.0.1', port, rejectUnauthorized: false });
  await new Promise<void>((r) => client.once('secureConnect', () => r()));
  const server = await serverSeite;
  return {
    server,
    client,
    schliesse: () => {
      client.destroy();
      server.destroy();
      srv.close();
    },
  };
}
