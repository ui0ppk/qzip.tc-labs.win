import { produce } from 'sveltekit-sse'

let count = 0;

let clients = new Set<{ emit: any }>;

export function GET() {
  count++;
  for(const client of clients) {
    client.emit('updated', `${Date.now()}`);
    client.emit('count', `${count}`);
  }

  return new Response(String(count))
}

export function POST() {
  let current_client: { emit: any };
  return produce(
    async function start({ emit }) {
      current_client = { emit };
      clients.add(current_client);

      emit('updated', `${Date.now()}`);
      emit('count', `${count}`);
    }, {
      stop({}) {
        clients.delete(current_client);
      }
    }
  );
}