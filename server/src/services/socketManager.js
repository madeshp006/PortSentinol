import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let io = null;

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // Allow same CORS settings as Express app
        callback(null, true);
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error("Authentication error: Token required"));
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.auth = payload;
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.auth.userId;
    console.log(`Socket client connected: ${socket.id} (User: ${userId})`);

    socket.join(`user:${userId}`);

    socket.on("disconnect", () => {
      console.log(`Socket client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function emitToUser(userId, event, payload) {
  if (io) {
    io.to(`user:${userId}`).emit(event, payload);
  }
}

export function emitToAll(event, payload) {
  if (io) {
    io.emit(event, payload);
  }
}

export function getIO() {
  return io;
}
