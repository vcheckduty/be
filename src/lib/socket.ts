import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Message } from '@/models/Message';
import User from '@/models/User';

let io: SocketIOServer | null = null;

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

export function initializeSocket(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log('User connected:', socket.id);

    // Authentication
    socket.on('authenticate', async (userId: string) => {
      try {
        const user = await User.findById(userId);
        if (user) {
          socket.userId = userId;
          socket.join(`user:${userId}`);
          console.log(`User ${userId} authenticated and joined room`);
          
          // Update user online status
          await User.findByIdAndUpdate(userId, { 
            isOnline: true,
            lastSeen: new Date()
          });
          
          // Broadcast online status
          socket.broadcast.emit('user:online', { userId });
        }
      } catch (error) {
        console.error('Authentication error:', error);
      }
    });

    // Send message
    socket.on('message:send', async (data: {
      senderId: string;
      receiverId: string;
      content: string;
      type?: 'text' | 'image' | 'file';
    }) => {
      try {
        const message = await Message.create({
          sender: data.senderId,
          receiver: data.receiverId,
          content: data.content,
          type: data.type || 'text',
          timestamp: new Date(),
          status: 'sent',
        });

        await message.populate(['sender', 'receiver']);

        // Send to receiver
        io?.to(`user:${data.receiverId}`).emit('message:receive', message);
        
        // Confirm to sender
        socket.emit('message:sent', message);
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('message:error', { error: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing:start', (data: { senderId: string; receiverId: string }) => {
      io?.to(`user:${data.receiverId}`).emit('typing:user', {
        userId: data.senderId,
        isTyping: true,
      });
    });

    socket.on('typing:stop', (data: { senderId: string; receiverId: string }) => {
      io?.to(`user:${data.receiverId}`).emit('typing:user', {
        userId: data.senderId,
        isTyping: false,
      });
    });

    // Message read
    socket.on('message:read', async (data: { messageId: string; userId: string }) => {
      try {
        const message = await Message.findByIdAndUpdate(
          data.messageId,
          { status: 'read', readAt: new Date() },
          { new: true }
        );
        
        if (message) {
          // Notify sender
          io?.to(`user:${message.sender}`).emit('message:read', {
            messageId: data.messageId,
            readAt: message.readAt,
          });
        }
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id);
      
      if (socket.userId) {
        // Update user offline status
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastSeen: new Date(),
        });
        
        // Broadcast offline status
        socket.broadcast.emit('user:offline', { 
          userId: socket.userId,
          lastSeen: new Date(),
        });
      }
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}
