import { NextRequest, NextResponse } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export async function GET(request: NextRequest) {
  if (!io) {
    return NextResponse.json(
      { message: 'Socket.io server not initialized yet' },
      { status: 503 }
    );
  }

  return NextResponse.json({
    connected: true,
    clients: io.engine.clientsCount,
  });
}
