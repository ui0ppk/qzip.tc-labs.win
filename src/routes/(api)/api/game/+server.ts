import type { Socket } from '@sveltejs/kit';


let clients: Client[] = [];

const get_players = () => clients.map((item) => ({
  name: item.name,
  position: item.position,
  messages: item.messages
}));

export const socket: Socket = {
	upgrade(req) {
		console.log('upgrade');
	},

	open(peer) {
    console.log(peer.id);

		const name = `guest<${Math.round(Math.random() * 10)}>`;

		const client = {
			id: peer.id,
			
			name: name,
			position: {
				x: 0,
				y: 0
			},
			messages: []
		};

		clients.push(client);
		peer.send({
			type: "this_client",
			client: client
		});

		const players = JSON.stringify({
			type: "players",
			players: get_players()
		});

		// send to thyself.
		peer.send(players);

		peer.subscribe("players");
		peer.subscribe("messages");

		peer.publish("players", players);
		console.log("sent data!")
  },

	close(peer) {
		const client = clients.find((client) => client.id === peer.id);

		if(client) {
			delete clients[clients.indexOf(client)];
			clients = clients.filter((client) => client !== null);
		}
	},

	message(peer, message) {
    try {
			const data = message.json() as {
				type: string,
				[key: string]: any
			};

			const client = clients.find((client) => client.id === peer.id);

			if(!client) {
				return;
			}

			switch(data.type) {
				case "position":
					const position = data.position as Position;

					if(position.x && position.y) {
						client.position = position;

						clients[clients.indexOf(client)] = client;

						const players = JSON.stringify({
							type: "players",
							players: get_players()
						});

						peer.publish("players", players);
					}
				break;
				case "message": 
					const message = data.message as {
						text: string
					};

					if(message.text.length > 0) {
						client.messages.push({
							text: message.text,
							sent: Date.now()
						})
						clients[clients.indexOf(client)] = client;

						const players = JSON.stringify({
							type: "players",
							players: get_players()
						});


						const messages = JSON.stringify({
							type: "messages",
							message: message.text,
							from: client.name
						});

						peer.send(messages)

						peer.publish("players", players);
						peer.publish("messages", messages);
					}
				break;
			}
		} catch(e) {};
	}
}