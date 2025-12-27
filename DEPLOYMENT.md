# V-Check Backend Deployment Guide

## Deployment to Render.com

### Environment Variables

Set these in Render Dashboard:

```bash
# MongoDB
MONGODB_URI=mongodb+srv://admin:05112004@vcheck.yga82jd.mongodb.net/vcheck?retryWrites=true&w=majority&appName=vcheck

# JWT
JWT_SECRET=cc17a6945bc52a7dc54174960882e609f1101d66605fa66efefcc42e436a2d013f15506f9562e9cf5e7b34506690d83cdce4dd8252d7490389a173f588b3fa85

# Server - Render will auto-set PORT
# PORT will be automatically provided by Render

# Frontend URL (your frontend domain)
FRONTEND_URL=https://vcheck-fe.onrender.com

# Email (Optional - for OTP feature)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Build & Start Commands

```bash
# Build Command
pnpm install && pnpm build

# Start Command
pnpm start
```

### Important Notes

1. **Single Service**: Backend includes both REST API and Socket.io on the same port
2. **Port**: Render automatically provides `PORT` environment variable
3. **CORS**: Make sure to add your frontend URL to `FRONTEND_URL`
4. **WebSocket**: Render supports WebSocket connections by default

### Local Development

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env.local

# Edit .env.local with your values

# Run development server
pnpm dev
```

The server will run on `http://localhost:3000` with both:
- REST API endpoints: `http://localhost:3000/api/*`
- Socket.io connection: `ws://localhost:3000`

### Frontend Configuration

Update your frontend `.env.local`:

```bash
# Development
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000

# Production
NEXT_PUBLIC_API_URL=https://vcheck-be.onrender.com
NEXT_PUBLIC_BACKEND_URL=https://vcheck-be.onrender.com
```

Both API calls and Socket.io will use the same URL! 🎉

### Chat System

- **Officers**: Can only chat with their supervisor (auto-connected)
- **Supervisors**: Can chat with officers and other users
- **Admins**: Can chat with anyone
