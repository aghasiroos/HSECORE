import { Server as SocketServer, Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type { Response } from 'express';
import { logger } from './logger.ts';

// SSE (Server-Sent Events) clients registry
const sseClients = new Set<Response>();

export function registerSSEClient(res: Response) {
  sseClients.add(res);
  const cleanup = () => {
    sseClients.delete(res);
  };
  res.on('close', cleanup);
  res.on('finish', cleanup);
  res.on('error', cleanup);
}

export function getSSEClientCount(): number {
  return sseClients.size;
}

class SocketService {
  private io: SocketServer | null = null;
  private connectedUsers: Map<string, string> = new Map();

  initialize(server: HttpServer) {
    this.io = new SocketServer(server, {
      path: '/socket.io',
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      perMessageDeflate: false,
      pingTimeout: 20000,
      pingInterval: 10000,
      maxHttpBufferSize: 1e8,
    });

    this.io.on('connection', (socket: Socket) => {
      logger.debug(`WebSocket connected: ${socket.id}`);

      // Every connected client automatically joins public_emergency room for HSE critical alerts
      socket.join('public_emergency');

      // Optional: Store user ID if sent via auth payload
      const userId = socket.handshake.auth?.userId;
      if (userId) {
        this.connectedUsers.set(socket.id, userId);
      }

      socket.on('disconnect', () => {
        logger.debug(`WebSocket disconnected: ${socket.id}`);
        this.connectedUsers.delete(socket.id);
      });

      // Handle subscription to specific rooms (e.g. module names)
      socket.on('subscribe', (room: string) => {
        socket.join(room);
        logger.debug(`Socket ${socket.id} joined room ${room}`);
      });

      socket.on('unsubscribe', (room: string) => {
        socket.leave(room);
        logger.debug(`Socket ${socket.id} left room ${room}`);
      });
    });

    logger.info('WebSocket (Socket.IO) initialized.');
  }

  getIO(): SocketServer {
    if (!this.io) {
      throw new Error('Socket.io has not been initialized. Please call initialize() first.');
    }
    return this.io;
  }

  // Helper method to emit events to everyone
  broadcast(event: string, data: any) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  // Helper method to emit to a specific room
  broadcastToRoom(room: string, event: string, data: any) {
    if (this.io) {
      this.io.to(room).emit(event, data);
    }
  }
}

export const socketService = new SocketService();

/**
 * Universal broadcast for data mutations across all connected clients (WebSocket + SSE).
 * Ensures instant synchronization across different users and devices.
 */
export function broadcastDataMutation(entityType: string, action: string, data?: any) {
  const payload = {
    entityType,
    action,
    data,
    timestamp: new Date().toISOString(),
  };

  // 1. Broadcast via Socket.IO
  try {
    socketService.broadcast('data_mutated', payload);
  } catch (err: any) {
    logger.warn('Socket broadcast warning:', { error: err?.message });
  }

  // 2. Broadcast via Server-Sent Events (SSE)
  const message = `event: data_mutated\ndata: ${JSON.stringify(payload)}\n\n`;
  const deadClients: Response[] = [];
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      deadClients.push(client);
    }
  }
  for (const dead of deadClients) {
    sseClients.delete(dead);
  }
}

