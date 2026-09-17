export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const upgrade = request.headers.get("Upgrade");

    if (upgrade !== "websocket") {
      return new Response("ChatSphere room is running.", {
        status: 200
      });
    }

    const pair = new WebSocketPair();

    const client = pair[0];
    const server = pair[1];

    this.state.acceptWebSocket(server);

    server.send(JSON.stringify({
      type: "connected"
    }));

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  webSocketMessage(ws, message) {
    // Try to read the message as JSON
    let data;

    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    // Send the message to every other person in the room
    const sockets = this.state.getWebSockets();

    for (const socket of sockets) {
      if (socket !== ws) {
        try {
          socket.send(JSON.stringify(data));
        } catch {
          // Ignore disconnected sockets
        }
      }
    }
  }

  webSocketClose(ws) {
    // Tell the other person that their peer left
    const sockets = this.state.getWebSockets();

    for (const socket of sockets) {
      if (socket !== ws) {
        try {
          socket.send(JSON.stringify({
            type: "peer-left"
          }));
        } catch {
          // Ignore disconnected sockets
        }
      }
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const match = url.pathname.match(/^\/room\/([A-Za-z0-9_-]+)$/);

    if (!match) {
      return new Response(
        "ChatSphere signaling server is running.",
        { status: 200 }
      );
    }

    const roomCode = match[1];

    const room = env.CHAT_ROOM.getByName(roomCode);

    return room.fetch(request);
  }
};