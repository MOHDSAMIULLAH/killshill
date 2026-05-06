import 'dotenv/config';
import https from 'https';
import { lookup as dnsLookup } from 'dns';
import { promisify } from 'util';
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const lookupIPv4 = promisify(dnsLookup);

// Node.js v22 Happy Eyeballs picks IPv6 which silently drops TLS data on this
// network. Override fetch to resolve the hostname to IPv4 first.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
neonConfig.fetchFunction = async (url: string | URL, init: any = {}): Promise<any> => {
  const parsedUrl = new URL(url as string);
  const { address: ipv4 } = await lookupIPv4(parsedUrl.hostname, { family: 4 });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: ipv4,
        port: parseInt(parsedUrl.port || '443'),
        path: parsedUrl.pathname + parsedUrl.search,
        method: (String(init.method || 'GET')).toUpperCase(),
        headers: { ...(init.headers ?? {}), host: parsedUrl.hostname },
        servername: parsedUrl.hostname,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
            status: res.statusCode ?? 0,
            statusText: res.statusMessage ?? '',
            headers: {
              get: (name: string): string | null =>
                (res.headers[name.toLowerCase()] as string) ?? null,
              has: (name: string): boolean => name.toLowerCase() in res.headers,
            },
            json: () => Promise.resolve(JSON.parse(body)),
            text: () => Promise.resolve(body),
          });
        });
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    if (init.body) req.write(init.body as string);
    req.end();
  });
};

// neon() uses the Neon HTTP API (HTTPS port 443) — no TCP/WebSocket needed.
const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
