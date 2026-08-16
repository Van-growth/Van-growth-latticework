import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import analyzeRouter from './routes/analyze';
import analysesRouter from './routes/analyses';
import companiesRouter from './routes/companies';
import shareRouter from './routes/share';
import profileRouter from './routes/profile';
import industriesRouter from './routes/industries';
import benRouter from './routes/ben';
import { APP_ENV } from './lib/env';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const ALLOWED_ORIGINS = new Set([
  'https://latticework-client.onrender.com',
  'https://van-growth-latticework.onrender.com',
  'http://localhost:3000',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : []),
]);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.has(origin)) cb(null, true);
    else cb(new Error(`CORS: origin ${origin} not allowed`));
  },
}));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/analyze', analyzeRouter);
app.use('/api/analyses', analysesRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/share', shareRouter);
app.use('/api/profile', profileRouter);
app.use('/api/industries', industriesRouter);
app.use('/api/analyses', benRouter);

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT} (APP_ENV=${APP_ENV})`));
