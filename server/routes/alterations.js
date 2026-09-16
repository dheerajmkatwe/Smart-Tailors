const express = require('express');
const router = express.Router();
const { db, getActiveBranchId } = require('../db');

// ─── Helper: build date filter SQL ───────────────────────────────────────────
function buildDateFilter(period, col = 'date') {
    switch (period) {
        case 'today':
            return `AND ${col} = date('now', 'localtime')`;
        case 'week':
            return `AND ${col} >= date('now', 'localtime', 'weekday 0', '-6 days') AND ${col} <= date('now', 'localtime')`;
        case 'month':
            return `AND substr(${col}, 1, 7) = substr(date('now', 'localtime'), 1, 7)`;
        case 'year':
            return `AND substr(${col}, 1, 4) = substr(date('now', 'localtime'), 1, 4)`;
        default:
            return '';
    }
}

// ─── GET /api/alterations/dashboard ──────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
    try {
        const periods = ['today', 'week', 'month', 'year'];
        const queries = [];
        
        const bFilter = req.branchId && req.branchId !== 'all' ? ' AND branch_id = ?' : '';
        const bArgs = req.branchId && req.branchId !== 'all' ? [Number(req.branchId)] : [];

        for (const p of periods) {
            const f = buildDateFilter(p);
            queries.push({
                sql: `SELECT COUNT(*) as entries, COALESCE(SUM(total_alterations),0) as total_done, COALESCE(SUM(amount_received),0) as total_amount FROM alterations WHERE tenant_id = ? ${f}${bFilter}`,
                args: [req.tenantId, ...bArgs]
            });
        }
        // All time
        queries.push({
            sql: `SELECT COUNT(*) as entries, COALESCE(SUM(total_alterations),0) as total_done, COALESCE(SUM(amount_received),0) as total_amount FROM alterations WHERE tenant_id = ? ${bFilter}`,
            args: [req.tenantId, ...bArgs]
        });
        // Today's date from DB
        queries.push(`SELECT date('now', 'localtime') as today`);

        const results = await db.batch(queries, 'read');

        const mapRow = (row) => ({
            entries: Number(row?.entries || 0),
            total_done: Number(row?.total_done || 0),
            total_amount: Number(row?.total_amount || 0),
        });

        res.json({
            today_date: results[5].rows[0]?.today || new Date().toISOString().split('T')[0],
            today: mapRow(results[0].rows[0]),
            week: mapRow(results[1].rows[0]),
            month: mapRow(results[2].rows[0]),
            year: mapRow(results[3].rows[0]),
            alltime: mapRow(results[4].rows[0]),
        });
    } catch (err) {
        console.error('[Alterations] dashboard error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/alterations ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { period } = req.query;
        const f = buildDateFilter(period);
        
        const bFilter = req.branchId && req.branchId !== 'all' ? ' AND branch_id = ?' : '';
        const bArgs = req.branchId && req.branchId !== 'all' ? [Number(req.branchId)] : [];

        const rs = await db.execute({
            sql: `SELECT * FROM alterations WHERE tenant_id = ? ${f}${bFilter} ORDER BY date DESC, id DESC`,
            args: [req.tenantId, ...bArgs]
        });
        res.json(rs.rows);
    } catch (err) {
        console.error('[Alterations] list error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/alterations ────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const { date, total_alterations, amount_received, description } = req.body;

        if (!date) return res.status(400).json({ error: 'date is required' });
        if (total_alterations === undefined || total_alterations === null || total_alterations === '')
            return res.status(400).json({ error: 'total_alterations is required' });
        if (amount_received === undefined || amount_received === null || amount_received === '')
            return res.status(400).json({ error: 'amount_received is required' });

        const activeBranchId = await getActiveBranchId(req.tenantId, req.branchId);

        const rs = await db.execute({
            sql: `INSERT INTO alterations (date, total_alterations, amount_received, description, tenant_id, branch_id) VALUES (?, ?, ?, ?, ?, ?)`,
            args: [
                date,
                parseInt(total_alterations) || 0,
                parseFloat(amount_received) || 0,
                description || null,
                req.tenantId,
                activeBranchId
            ]
        });

        const newId = Number(rs.lastInsertRowid);
        const row = await db.execute({ sql: 'SELECT * FROM alterations WHERE id = ? AND tenant_id = ?', args: [newId, req.tenantId] });
        res.status(201).json(row.rows[0]);
    } catch (err) {
        console.error('[Alterations] create error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── DELETE /api/alterations/:id ──────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        await db.execute({ sql: 'DELETE FROM alterations WHERE id = ? AND tenant_id = ?', args: [req.params.id, req.tenantId] });
        res.json({ success: true });
    } catch (err) {
        console.error('[Alterations] delete error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── PUT /api/alterations/:id ─────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
    try {
        const { date, total_alterations, amount_received, description } = req.body;
        await db.execute({
            sql: `UPDATE alterations SET date=?, total_alterations=?, amount_received=?, description=? WHERE id=? AND tenant_id=?`,
            args: [date, parseInt(total_alterations) || 0, parseFloat(amount_received) || 0, description || null, req.params.id, req.tenantId]
        });
        const row = await db.execute({ sql: 'SELECT * FROM alterations WHERE id = ? AND tenant_id = ?', args: [req.params.id, req.tenantId] });
        res.json(row.rows[0]);
    } catch (err) {
        console.error('[Alterations] update error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
