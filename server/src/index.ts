import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import analyzeRouter from './routes/analyze';
import analysesRouter from './routes/analyses';
import shareRouter from './routes/share';
import cronRouter from './routes/cron';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const ALLOWED_ORIGINS = new Set([
  'https://latticework-client.onrender.com',
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
app.use('/api/share', shareRouter);
app.use('/api/cron', cronRouter);

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
