const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

const server = new WebSocket.Server({
    port: PORT
});

const rooms = new Map();

console.log(`ChatSphere signaling server running on port ${PORT}`);


server.on("connection", (socket) => {

    console.log("New client connected");


    socket.on("message", (data) => {

        let message;

        try {
            message = JSON.parse(data.toString());
        } catch (error) {

            console.log("Invalid JSON received");

            return;
        }


        // =========================
        // CREATE ROOM
        // =========================

        if (message.type === "create-room") {

            const roomId = message.roomId;

            rooms.set(roomId, {
                clients: [socket]
            });

            socket.roomId = roomId;

            socket.send(JSON.stringify({
                type: "room-created",
                roomId: roomId
            }));

            console.log(`Room created: ${roomId}`);

            return;
        }


        // =========================
        // JOIN ROOM
        // =========================

        if (message.type === "join-room") {

            const roomId = message.roomId;

            const room = rooms.get(roomId);

            if (!room) {

                socket.send(JSON.stringify({
                    type: "error",
                    message: "Room does not exist"
                }));

                return;
            }


            if (room.clients.length >= 2) {

                socket.send(JSON.stringify({
                    type: "error",
                    message: "Room is full"
                }));

                return;
            }


            room.clients.push(socket);

            socket.roomId = roomId;


            socket.send(JSON.stringify({
                type: "room-joined",
                roomId: roomId
            }));


            // Tell the first peer
            room.clients[0].send(JSON.stringify({
                type: "peer-joined"
            }));


            console.log(`Peer joined room: ${roomId}`);

            return;
        }


        // =========================
        // WEBRTC SIGNALING
        // =========================

        if (
            message.type === "offer" ||
            message.type === "answer" ||
            message.type === "ice-candidate"
        ) {

            const room = rooms.get(socket.roomId);

            if (!room) {
                return;
            }


            room.clients.forEach((client) => {

                if (
                    client !== socket &&
                    client.readyState === WebSocket.OPEN
                ) {

                    client.send(JSON.stringify(message));

                }

            });

        }

    });


    // =========================
    // DISCONNECT
    // =========================

    socket.on("close", () => {

        console.log("Client disconnected");


        const roomId = socket.roomId;

        if (!roomId) {
            return;
        }


        const room = rooms.get(roomId);

        if (!room) {
            return;
        }


        room.clients =
            room.clients.filter(
                client => client !== socket
            );


        // Tell remaining peer
        room.clients.forEach((client) => {

            if (client.readyState === WebSocket.OPEN) {

                client.send(JSON.stringify({
                    type: "peer-left"
                }));

            }

        });


        if (room.clients.length === 0) {

            rooms.delete(roomId);

            console.log(`Room deleted: ${roomId}`);

        }

    });

});