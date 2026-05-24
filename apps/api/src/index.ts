import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { errorHandler } from './middleware/errorHandler';
import { setupSocket } from './socket';
import { startJobRunner } from './jobs';
import authRoutes from './routes/auth.routes';
import channelRoutes from './routes/channels.routes';
import messageRoutes from './routes/messages.routes';
import alertRoutes from './routes/alerts.routes';
import dmRoutes from './routes/dms.routes';
import adminRoutes from './routes/admin.routes';
import winsRoutes from './routes/wins.routes';
import courseRoutes from './routes/courses.routes';

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('io', io);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dms', dmRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wins', winsRoutes);
app.use('/api/courses', courseRoutes);

app.use(errorHandler);

setupSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`SOA API running on port ${PORT}`);
  startJobRunner();
});

export { app, io };
