
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';

const port = 3000;
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer);
  const rooms: Record<string, string> = {}; 
  const socketRooms: Record<string, string> = {}; // Track socketId -> roomId

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Helper to leave room
    const leaveRoom = () => {
        const roomId = socketRooms[socket.id];
        if (roomId) {
            socket.leave(roomId);
            socket.to(roomId).emit('playerDisconnected', { playerId: socket.id });
            delete socketRooms[socket.id];
        }
    };

    // Basic signaling
    socket.on('createRoom', (roomId, password) => {
        rooms[roomId] = password;
        socket.join(roomId);
        socketRooms[socket.id] = roomId;
        console.log(`Socket ${socket.id} created and joined room ${roomId}`);
        socket.emit('roomCreated', roomId);
    });

    socket.on('joinRoom', (roomId, password) => {
        if (rooms[roomId] === password) {
            socket.join(roomId);
            socketRooms[socket.id] = roomId;
            console.log(`Socket ${socket.id} joined room ${roomId}`);
            socket.emit('joined', roomId);
        } else {
            socket.emit('error', 'Invalid password or room');
        }
    });


    socket.on('offer', (data) => {
        socket.to(data.roomId).emit('offer', data);
    });

    socket.on('answer', (data) => {
        socket.to(data.roomId).emit('answer', data);
    });

    socket.on('gameInput', (data) => {
        // Broadcast input to others in the room
        socket.to(data.roomId).emit('gameInput', { ...data, senderId: socket.id });
    });

    socket.on('gameStateUpdate', (data) => {
        // Broadcast state update to others in the room
        socket.to(data.roomId).emit('gameStateUpdate', { ...data, senderId: socket.id });
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      leaveRoom();
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
