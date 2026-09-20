require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Initialize DB (creates tables if not exist)
const { initDB } = require('./db');
initDB().catch(err => console.error('❌ Database Initialization Error:', err));

const authRouter = require('./routes/auth');
const customersRouter = require('./routes/customers');
const ordersRouter = require('./routes/orders');
const dashboardRouter = require('./routes/dashboard');
const pdfRouter = require('./routes/pdf');
const analyticsRouter = require('./routes/analytics');
const alterationsRouter = require('./routes/alterations');
const trackRouter = require('./routes/track');
const razorpayRouter = require('./routes/razorpay');

const app = express();

const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl requests, or same-origin)
        if (!origin) return callback(null, true);

        // Allow any Vercel domain or localhost
        if (origin.endsWith('.vercel.app') || origin.startsWith('http://localhost:')) {
            return callback(null, true);
        }

        // As a fallback for any other custom domains the user might add later
        return callback(null, true);
    },
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Tenant & Branch Extraction Middleware
app.use((req, res, next) => {
    req.tenantId = req.headers['x-tenant-id'] || 'default';
    const bId = req.headers['x-branch-id'];
    req.branchId = (bId && bId !== 'all' && bId !== 'undefined' && bId !== 'null') ? bId : null;
    next();
});

// ─── Routes ───────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/customers', customersRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/pdf', pdfRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/alterations', alterationsRouter);
app.use('/api/track', trackRouter); // Public — no auth required
app.use('/api/razorpay', razorpayRouter);


// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'SMART TAILOR Backend is running 🧵' });
});

app.get('/api/health/db-init', async (req, res) => {
    try {
        await initDB();
        res.json({ status: 'success', message: 'Database initialized successfully!' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message, stack: err.stack });
    }
});

// ─── Start ────────────────────────────────────────
// Export app for Vercel Serverless
module.exports = app;

if (process.env.NODE_ENV !== 'production' || require.main === module) {
    app.listen(PORT, () => {
        console.log(`\n🧵 SMART TAILOR Billing Server`);
        console.log(`   Running at → http://localhost:${PORT}`);
        console.log(`   Health     → http://localhost:${PORT}/api/health\n`);
    });
}
