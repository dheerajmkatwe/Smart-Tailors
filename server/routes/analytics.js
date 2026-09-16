const express = require('express');
const router = express.Router();
const { db, checkPremiumStatus, getActiveBranchId } = require('../db');


// GET /api/analytics/expenses
router.get('/expenses', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const branchId = (req.branchId && req.branchId !== 'all') ? Number(req.branchId) : null;
        const results = await getExpensesData(req.tenantId, start_date, end_date, branchId);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/analytics/expenses
router.post('/expenses', async (req, res) => {
    try {
        const { date, category, amount, description } = req.body;
        if (!date || !category || amount === undefined) {
            return res.status(400).json({ error: 'date, category, amount required' });
        }
        const activeBranchId = await getActiveBranchId(req.tenantId, req.branchId);

        await db.execute({
            sql: 'INSERT INTO expenses (date, category, amount, description, tenant_id, branch_id) VALUES (?,?,?,?,?,?)',
            args: [date, category, parseFloat(amount), description || '', req.tenantId, activeBranchId]
        });
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/analytics/expenses/:id
router.delete('/expenses/:id', async (req, res) => {
    try {
        await db.execute({ sql: 'DELETE FROM expenses WHERE id = ? AND tenant_id = ?', args: [req.params.id, req.tenantId] });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analytics/summary
router.get('/summary', async (req, res) => {
    try {
        const isPremium = await checkPremiumStatus(req.tenantId);
        const branchId = (req.branchId && req.branchId !== 'all') ? Number(req.branchId) : null;
        const results = await getSummaryData(req.tenantId, isPremium, branchId);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analytics/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const isPremium = await checkPremiumStatus(req.tenantId);
        const branchId = (req.branchId && req.branchId !== 'all') ? Number(req.branchId) : null;
        
        const [summary, expenses, services, customers, monthlyRecords] = await Promise.all([
            getSummaryData(req.tenantId, isPremium, branchId),
            getExpensesData(req.tenantId, null, null, branchId),
            getTopServicesData(req.tenantId, branchId),
            getTopCustomersData(req.tenantId, branchId),
            getMonthlyRecordsData(req.tenantId, isPremium, branchId)
        ]);
        res.json({ summary, expenses, services, customers, monthlyRecords });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

async function getMonthlyRecordsData(tenantId, isPremium, branchId) {
    const bFilter = branchId ? ' AND branch_id = ?' : '';
    let query = `
        SELECT month, SUM(income) as total_income, SUM(expense) as total_expense 
        FROM (
            SELECT substr(booking_date, 1, 7) as month, total_amount as income, 0 as expense FROM orders WHERE tenant_id = ? ${bFilter}
            UNION ALL
            SELECT substr(date, 1, 7) as month, 0 as income, amount as expense FROM expenses WHERE tenant_id = ? ${bFilter}
            UNION ALL
            SELECT substr(booking_date, 1, 7) as month, 0 as income, stitching_expense as expense FROM orders WHERE stitching_expense > 0 AND tenant_id = ? ${bFilter}
        ) 
    `;
    if (!isPremium) {
        query += " WHERE month = strftime('%Y-%m', 'now', 'localtime') ";
    }
    query += `
        GROUP BY month 
        ORDER BY month DESC
        LIMIT 12
    `;
    
    const args = branchId 
        ? [tenantId, branchId, tenantId, branchId, tenantId, branchId]
        : [tenantId, tenantId, tenantId];

    const rs = await db.execute({ sql: query, args });
    return rs.rows.map(r => ({
        month: r.month,
        total: r.total_income || 0,
        expense: r.total_expense || 0,
        profit: (r.total_income || 0) - (r.total_expense || 0)
    }));
}

async function getSummaryData(tenantId, isPremium, branchId) {
    const queries = {
        total_income: "SELECT sum(total_amount) as val FROM orders WHERE tenant_id = ?",
        today_income: "SELECT sum(total_amount) as val FROM orders WHERE booking_date = date('now', 'localtime') AND tenant_id = ?",
        monthly_income: "SELECT sum(total_amount) as val FROM orders WHERE substr(booking_date, 1, 7) = substr(date('now', 'localtime'), 1, 7) AND tenant_id = ?",
        yearly_income: "SELECT sum(total_amount) as val FROM orders WHERE substr(booking_date, 1, 4) = substr(date('now', 'localtime'), 1, 4) AND tenant_id = ?",

        total_stitching: "SELECT sum(stitching_expense) as val FROM orders WHERE tenant_id = ?",
        today_stitching: "SELECT sum(stitching_expense) as val FROM orders WHERE booking_date = date('now', 'localtime') AND tenant_id = ?",
        monthly_stitching: "SELECT sum(stitching_expense) as val FROM orders WHERE substr(booking_date, 1, 7) = substr(date('now', 'localtime'), 1, 7) AND tenant_id = ?",
        yearly_stitching: "SELECT sum(stitching_expense) as val FROM orders WHERE substr(booking_date, 1, 4) = substr(date('now', 'localtime'), 1, 4) AND tenant_id = ?",

        total_expense: "SELECT sum(amount) as val FROM expenses WHERE tenant_id = ?",
        today_expense: "SELECT sum(amount) as val FROM expenses WHERE date = date('now', 'localtime') AND tenant_id = ?",
        monthly_expense: "SELECT sum(amount) as val FROM expenses WHERE substr(date, 1, 7) = substr(date('now', 'localtime'), 1, 7) AND tenant_id = ?",
        yearly_expense: "SELECT sum(amount) as val FROM expenses WHERE substr(date, 1, 4) = substr(date('now', 'localtime'), 1, 4) AND tenant_id = ?",

        total_balance: "SELECT sum(total_amount - advance_paid) as val FROM orders WHERE status != 'Delivered' AND tenant_id = ?",
        today_balance: "SELECT sum(total_amount - advance_paid) as val FROM orders WHERE status != 'Delivered' AND booking_date = date('now', 'localtime') AND tenant_id = ?",
        monthly_balance: "SELECT sum(total_amount - advance_paid) as val FROM orders WHERE status != 'Delivered' AND substr(booking_date, 1, 7) = substr(date('now', 'localtime'), 1, 7) AND tenant_id = ?",
        yearly_balance: "SELECT sum(total_amount - advance_paid) as val FROM orders WHERE status != 'Delivered' AND substr(booking_date, 1, 4) = substr(date('now', 'localtime'), 1, 4) AND tenant_id = ?",
    };

    const queryEntries = Object.entries(queries);
    const rsBatch = await db.batch(queryEntries.map(([_, sql]) => {
        const finalSql = branchId ? `${sql} AND branch_id = ?` : sql;
        const finalArgs = branchId ? [tenantId, branchId] : [tenantId];
        return { sql: finalSql, args: finalArgs };
    }), "read");
    
    const results = {};
    queryEntries.forEach(([key, _], i) => results[key] = rsBatch[i].rows[0]?.val || 0);

    results.today_expense = (results.today_expense || 0) + (results.today_stitching || 0);
    results.monthly_expense = (results.monthly_expense || 0) + (results.monthly_stitching || 0);
    results.yearly_expense = (results.yearly_expense || 0) + (results.yearly_stitching || 0);
    results.total_expense = (results.total_expense || 0) + (results.total_stitching || 0);

    results.today_profit = results.today_income - results.today_expense;
    results.monthly_profit = results.monthly_income - results.monthly_expense;
    results.yearly_profit = results.yearly_income - results.yearly_expense;
    results.net_profit = results.total_income - results.total_expense;

    if (!isPremium) {
        results.yearly_income = 0;
        results.yearly_expense = 0;
        results.yearly_stitching = 0;
        results.yearly_balance = 0;
        results.yearly_profit = 0;
        
        results.total_income = 0;
        results.total_expense = 0;
        results.total_stitching = 0;
        results.total_balance = 0;
        results.net_profit = 0;
    }

    return results;
}

async function getExpensesData(tenantId, start_date, end_date, branchId) {
    let q = `SELECT id, date, category, amount, description, 'expense' as type FROM expenses WHERE tenant_id = ?`;
    let args = [tenantId];
    if (branchId) { q += ' AND branch_id = ?'; args.push(branchId); }
    if (start_date) { q += ' AND date >= ?'; args.push(start_date); }
    if (end_date) { q += ' AND date <= ?'; args.push(end_date); }

    let sq = `SELECT order_id as id, booking_date as date, assigned_worker as category, stitching_expense as amount, 'Order #' || order_id as description, 'stitching' as type FROM orders WHERE stitching_expense > 0 AND tenant_id = ?`;
    let sargs = [tenantId];
    if (branchId) { sq += ' AND branch_id = ?'; sargs.push(branchId); }
    if (start_date) { sq += ' AND booking_date >= ?'; sargs.push(start_date); }
    if (end_date) { sq += ' AND booking_date <= ?'; sargs.push(end_date); }

    const rs = await db.execute({ sql: `SELECT * FROM (${q} UNION ALL ${sq}) ORDER BY date DESC LIMIT 50`, args: [...args, ...sargs] });
    return rs.rows;
}

async function getTopServicesData(tenantId, branchId) {
    const rs = await db.execute({
        sql: `SELECT s.service_type, COUNT(*) as count, SUM(s.price * s.quantity) as revenue 
              FROM services s 
              JOIN orders o ON o.order_id = s.order_id
              WHERE o.tenant_id = ? ${branchId ? 'AND o.branch_id = ?' : ''}
              GROUP BY s.service_type 
              ORDER BY revenue DESC LIMIT 5`,
        args: branchId ? [tenantId, branchId] : [tenantId]
    });
    return rs.rows;
}

async function getTopCustomersData(tenantId, branchId) {
    const rs = await db.execute({
        sql: `SELECT c.id, c.name, c.phone_number, COUNT(o.order_id) as order_count, SUM(o.total_amount) as total_spent 
              FROM customers c 
              JOIN orders o ON c.id = o.customer_id 
              WHERE c.tenant_id = ? AND o.tenant_id = ? ${branchId ? 'AND o.branch_id = ?' : ''}
              GROUP BY c.id 
              ORDER BY total_spent DESC LIMIT 5`,
        args: branchId ? [tenantId, tenantId, branchId] : [tenantId, tenantId]
    });
    return rs.rows;
}

router.get('/top-services', async (req, res) => {
    try {
        const branchId = (req.branchId && req.branchId !== 'all') ? Number(req.branchId) : null;
        res.json(await getTopServicesData(req.tenantId, branchId));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/top-customers', async (req, res) => {
    try {
        const branchId = (req.branchId && req.branchId !== 'all') ? Number(req.branchId) : null;
        res.json(await getTopCustomersData(req.tenantId, branchId));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
