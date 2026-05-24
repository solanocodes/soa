import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import dotenv from 'dotenv';
import { initSocket } from './socket';
import authRoutes from './routes/auth';
import channelRoutes from './routes/channels';
import messageRoutes from './routes/messages';
import alertRoutes from './routes/alerts';
import journalRoutes from './routes/journal';
import userRoutes from './routes/users';
import courseRoutes from './routes/courses';
import winsRoutes from './routes/wins';
import adminRoutes from './routes/admin';
import paymentRoutes from './routes/payments';
import propfirmRoutes from './routes/propfirm';
import referralRoutes from './routes/referrals';
import leaderboardRoutes from './routes/leaderboard';
import liveRoutes from './routes/live';
import dmRoutes from './routes/dm';
import { startAutomationEngine } from './services/automation';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Make io available to routes
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/wins', winsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/propfirm', propfirmRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/dm', dmRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Socket.io
initSocket(io);

// Start automation engine
startAutomationEngine();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`SOA Backend running on port ${PORT}`);
});

export { io };
