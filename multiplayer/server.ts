import { createMemoryDriver } from 'gatho/driver';
import { createGathoSDK } from 'gatho/sdk';
import { start, subprocess } from 'gatho/server';
import { createServer } from 'node:http';

const apiPort = Number(process.env.MULTIPLAYER_PORT ?? 7100);
const publicUrl = process.env.MULTIPLAYER_PUBLIC_URL;
const driver = createMemoryDriver();
const server = await start({
  rooms: {
    world: subprocess([
      'node',
      '--experimental-strip-types',
      new URL('./room.ts', import.meta.url).pathname,
    ]),
  },
  driver,
  port: apiPort + 1,
  roomEndpoint: ({ port }) =>
    publicUrl
      ? `${publicUrl.replace(/^http/, 'ws')}/room/${port}`
      : `ws://localhost:${port}`,
});
const gatho = createGathoSDK({ driver });
const world = await gatho.createRoom({ type: 'world', serverId: server.serverId });

const api = createServer(async (request, response) => {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-methods', 'POST, OPTIONS');
  if (request.method === 'OPTIONS') return response.end();
  if (request.method !== 'POST' || request.url !== '/join') {
    response.writeHead(404);
    return response.end('not found');
  }

  try {
    const seat = await gatho.join({ roomId: world.roomId, ttl: 60_000 });
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ url: seat.url }));
  } catch {
    response.writeHead(503);
    response.end('multiplayer unavailable');
  }
});

api.listen(apiPort);

const shutdown = async () => {
  api.close();
  await server.stop();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
