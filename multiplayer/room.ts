import { create } from 'gatho/room';

type Transform = {
  type: 'transform';
  color: number;
  position: [number, number, number];
  quaternion: [number, number, number, number];
};

const players = new Map<string, Transform>();
const lastMessageAt = new Map<string, number>();

const room = create({
  onJoin: (client) => {
    client.send(JSON.stringify({ type: 'snapshot', players: [...players] }));
  },
  onMessage: (client, message) => {
    if (typeof message !== 'string' || message.length > 512) return;
    const now = Date.now();
    if (now - (lastMessageAt.get(client.id) ?? 0) < 15) return;
    lastMessageAt.set(client.id, now);

    try {
      const transform = JSON.parse(message) as Transform;
      const values = [...transform.position, ...transform.quaternion];
      const quaternionLength = Math.hypot(...transform.quaternion);
      if (
        transform.type !== 'transform' ||
        !Number.isInteger(transform.color) ||
        transform.color < 0 ||
        transform.color > 0xffffff ||
        transform.position?.length !== 3 ||
        transform.quaternion?.length !== 4 ||
        quaternionLength < 0.5 ||
        quaternionLength > 1.5 ||
        !values.every((value) => Number.isFinite(value) && Math.abs(value) < 100_000)
      ) {
        return;
      }

      const cleanTransform: Transform = {
        type: 'transform',
        color: transform.color,
        position: transform.position,
        quaternion: transform.quaternion.map(
          (value) => value / quaternionLength
        ) as Transform['quaternion'],
      };
      players.set(client.id, cleanTransform);
      room.broadcast(JSON.stringify({ ...cleanTransform, id: client.id }), {
        except: client,
        reliable: false,
      });
    } catch {
      // Ignore malformed client packets.
    }
  },
  onDrop: (client) => client.allowReconnection(10_000),
  onLeave: (client) => {
    players.delete(client.id);
    lastMessageAt.delete(client.id);
    room.broadcast(JSON.stringify({ type: 'leave', id: client.id }));
  },
});

await room.start();
