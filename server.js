require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');
const rateLimit = require('express-rate-limit');

const { testConnection } = require('./src/db');
const routes = require('./src/routes');
const { notFound, errorHandler } = require('./src/middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const origins = [
  process.env.CORS_ORIGIN || 'http://localhost:3000',
  'http://localhost:3000', 'http://localhost:3001',
];
app.use(cors({ origin: origins, credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads')));

app.use(rateLimit({ windowMs: 15*60*1000, max: 200, standardHeaders: true }));

app.get('/',        (_, res) => res.json({ success: true, message: 'St Johns SMS API', version: '1.0.0' }));
app.get('/health',  (_, res) => res.json({ success: true, status: 'healthy', uptime: process.uptime() }));
app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  await testConnection();
  app.listen(PORT, () => {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║   St Johns SMS — School Management System API   ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`  API:    http://localhost:${PORT}/api`);
    console.log(`  Health: http://localhost:${PORT}/health\n`);
  });
}

start().catch(err => { console.error('Startup failed:', err); process.exit(1); });
module.exports = app;
