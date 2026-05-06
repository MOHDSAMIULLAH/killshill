require('dotenv').config();
const https = require('https');
const { lookup: dnsLookup } = require('dns');
const { promisify } = require('util');
const { neon, neonConfig } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const schema = require('./schema');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const lookupIPv4 = promisify(dnsLookup);

// Node.js v22 Happy Eyeballs picks IPv6 which silently drops TLS data on this
// network. Override fetch to resolve the hostname to IPv4 first.
neonConfig.fetchFunction = async (url, init = {}) => {
  const parsedUrl = new URL(url);
  const { address: ipv4 } = await lookupIPv4(parsedUrl.hostname, { family: 4 });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: ipv4,
        port: parseInt(parsedUrl.port) || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: (init.method || 'GET').toUpperCase(),
        headers: { ...(init.headers || {}), host: parsedUrl.hostname },
        servername: parsedUrl.hostname,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: {
              get: (name) => res.headers[name.toLowerCase()] ?? null,
              has: (name) => name.toLowerCase() in res.headers,
            },
            json: () => Promise.resolve(JSON.parse(body)),
            text: () => Promise.resolve(body),
          });
        });
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    if (init.body) req.write(init.body);
    req.end();
  });
};

// neon() uses the Neon HTTP API (HTTPS port 443) — no TCP/WebSocket needed.
const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

module.exports = { db };
