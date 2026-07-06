import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const port = 3000;
const dev = process.env.NODE_ENV !== 'production';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  if (dev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(resolve(__dirname, 'dist/client')));
    app.use('*', (req, res) => {
      res.sendFile(resolve(__dirname, 'dist/client/index.html'));
    });
  }

  const io = new Server(httpServer);
  const rooms: Record<string, string> = {}; // Record<string, string>
  const socketRooms: Record<string, string> = {}; // Track socketId -> roomId

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    const leaveRoom = () => {
      const roomId = socketRooms[socket.id];
      if (roomId) {
        socket.leave(roomId);
        socket.to(roomId).emit('playerDisconnected', { playerId: socket.id });
        delete socketRooms[socket.id];
      }
    };

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
      socket.to(data.roomId).emit('gameInput', { ...data, senderId: socket.id });
    });

    socket.on('gameStateUpdate', (data) => {
      socket.to(data.roomId).emit('gameStateUpdate', { ...data, senderId: socket.id });
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      leaveRoom();
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (dev: ${dev})`);
  });
}

startServer();
