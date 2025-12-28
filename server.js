const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // Listen on all interfaces for deployment
const port = parseInt(process.env.PORT || '3001', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Models will be loaded dynamically after mongoose connection
let Message, User, Conversation;

// Configure CORS
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const corsMiddleware = cors(corsOptions);

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    // Handle CORS
    corsMiddleware(req, res, async (err) => {
      if (err) {
        res.statusCode = 500;
        res.end('Internal Server Error');
        return;
      }

      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('internal server error');
      }
    });
  });

  // Initialize Socket.io with same CORS settings
  const io = new Server(httpServer, {
    cors: corsOptions,
  });

  // Connect to MongoDB
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vcheck';
  mongoose.connect(MONGODB_URI).then(() => {
    console.log('✅ Connected to MongoDB');
    
    // Define schemas inline since we're in a plain JS file
    
    // Message Schema
    const messageSchema = new mongoose.Schema({
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      content: { type: String, required: true },
      type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
      timestamp: { type: Date, default: Date.now, index: true },
      status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
      readAt: { type: Date },
      attachmentUrl: { type: String },
      attachmentName: { type: String },
      attachmentSize: { type: Number },
    }, { timestamps: true });
    
    messageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });
    messageSchema.index({ receiver: 1, status: 1 });
    
    Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
    
    // Conversation Schema
    const conversationSchema = new mongoose.Schema({
      participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
      lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
      unreadCounts: {
        type: Map,
        of: Number,
        default: {}
      }
    }, { timestamps: true });
    
    conversationSchema.index({ participants: 1 });
    conversationSchema.index({ updatedAt: -1 });
    
    Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);

    // User - just reference the existing model, don't create new one
    // The User model with comparePassword method will be loaded by Next.js API routes
    User = mongoose.models.User;
    
  }).catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Authentication
    socket.on('authenticate', async (userId) => {
      try {
        if (!User) {
          // Wait a bit for User model to be loaded by Next.js
          setTimeout(() => {
            User = mongoose.models.User;
          }, 100);
        }
        
        // Use findById with minimal fields needed for socket operations
        const user = await mongoose.connection.collection('users').findOne(
          { _id: new mongoose.Types.ObjectId(userId) }
        );
        
        if (user) {
          socket.userId = userId;
          socket.join(`user:${userId}`);
          console.log(`User ${userId} authenticated and joined room`);
          
          // Update user online status
          await mongoose.connection.collection('users').updateOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            { 
              $set: { 
                isOnline: true,
                lastSeen: new Date()
              }
            }
          );
          
          // Broadcast online status
          socket.broadcast.emit('user:online', { userId });
        }
      } catch (error) {
        console.error('Authentication error:', error);
      }
    });

    // Send message
    socket.on('message:send', async (data) => {
      try {
        if (!Message) {
          console.error('Message model not loaded yet');
          socket.emit('message:error', { error: 'Server not ready' });
          return;
        }
        
        const message = await Message.create({
          sender: data.senderId,
          receiver: data.receiverId,
          content: data.content,
          type: data.type || 'text',
          timestamp: new Date(),
          status: 'sent',
        });

        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'username fullName')
          .populate('receiver', 'username fullName');

        // Send to receiver
        io.to(`user:${data.receiverId}`).emit('message:receive', populatedMessage);
        
        // Confirm to sender
        socket.emit('message:sent', populatedMessage);

        // Update Conversation
        if (Conversation) {
          const participants = [data.senderId, data.receiverId];
          
          let conversation = await Conversation.findOne({
            participants: { $all: participants }
          });

          if (!conversation) {
            conversation = new Conversation({
              participants: participants,
              unreadCounts: {}
            });
          }

          conversation.lastMessage = message._id;
          
          // Increment unread count for receiver
          const receiverIdStr = data.receiverId.toString();
          const currentUnread = conversation.unreadCounts.get(receiverIdStr) || 0;
          conversation.unreadCounts.set(receiverIdStr, currentUnread + 1);
          
          await conversation.save();
        }
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('message:error', { error: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing:start', (data) => {
      io.to(`user:${data.receiverId}`).emit('typing:user', {
        userId: data.senderId,
        isTyping: true,
      });
    });

    socket.on('typing:stop', (data) => {
      io.to(`user:${data.receiverId}`).emit('typing:user', {
        userId: data.senderId,
        isTyping: false,
      });
    });

    // Message read (single message)
    socket.on('message:read', async (data) => {
      try {
        const message = await Message.findByIdAndUpdate(
          data.messageId,
          { status: 'read', readAt: new Date() },
          { new: true }
        );
        
        if (message) {
          // Notify sender
          io.to(`user:${message.sender}`).emit('message:read', {
            messageId: data.messageId,
            readAt: message.readAt,
          });

          // Update Conversation unread count
          if (Conversation) {
            const participants = [message.sender, message.receiver];
            const conversation = await Conversation.findOne({
              participants: { $all: participants }
            });
            
            if (conversation) {
              // Reset unread count for the reader (the receiver of the message)
              // The user who calls 'message:read' is the receiver of the message
              const readerId = message.receiver.toString();
              conversation.unreadCounts.set(readerId, 0);
              await conversation.save();
            }
          }
        }
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    // Mark all messages from a sender as read
    socket.on('messages:mark-all-read', async (data) => {
      try {
        const { senderId, receiverId } = data;
        
        // Update all unread messages from sender to receiver
        const result = await Message.updateMany(
          {
            sender: senderId,
            receiver: receiverId,
            status: { $ne: 'read' }
          },
          {
            $set: {
              status: 'read',
              readAt: new Date()
            }
          }
        );

        // Update Conversation unread count
        if (Conversation) {
          const conversation = await Conversation.findOne({
            participants: { $all: [senderId, receiverId] }
          });
          
          if (conversation) {
            conversation.unreadCounts.set(receiverId, 0);
            await conversation.save();
          }
        }

        // Notify sender that all messages were read
        io.to(`user:${senderId}`).emit('messages:all-read', {
          readerId: receiverId,
          count: result.modifiedCount,
          readAt: new Date()
        });

        // Confirm to receiver
        socket.emit('messages:mark-all-read:success', {
          count: result.modifiedCount
        });

      } catch (error) {
        console.error('Mark all read error:', error);
        socket.emit('messages:mark-all-read:error', { 
          error: 'Failed to mark messages as read' 
        });
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id);
      
      if (socket.userId) {
        try {
          // Update user offline status using direct collection access
          await mongoose.connection.collection('users').updateOne(
            { _id: new mongoose.Types.ObjectId(socket.userId) },
            {
              $set: {
                isOnline: false,
                lastSeen: new Date(),
              }
            }
          );
          
          // Broadcast offline status
          socket.broadcast.emit('user:offline', { 
            userId: socket.userId,
            lastSeen: new Date(),
          });
        } catch (error) {
          console.error('Disconnect error:', error);
        }
      }
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log('> Socket.io server running');
    });
});
