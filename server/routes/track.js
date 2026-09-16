const express = require('express');
const router = express.Router();
const { db } = require('../db');

/**
 * GET /api/track/:orderId
 * Public endpoint — no authentication required.
 * Returns sanitized order info for the customer self-service tracker.
 */
router.get('/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { phone } = req.query;

        if (!phone) {
            return res.status(400).json({ error: 'Phone number verification required' });
        }

        // Validate orderId is numeric
        if (!/^\d+$/.test(orderId)) {
            return res.status(400).json({ error: 'Invalid order ID format' });
        }

        const orderRs = await db.execute({
            sql: `SELECT 
                    o.order_id, o.order_number, o.status, o.booking_date, o.delivery_date,
                    o.total_amount, o.advance_paid, o.balance_amount, o.notes, o.created_at,
                    c.name AS customer_name, c.phone_number AS customer_phone,
                    t.shop_name, t.address AS shop_address, t.phone_number AS shop_phone, 
                    t.upi_id AS shop_upi
                  FROM orders o
                  JOIN customers c ON c.id = o.customer_id
                  JOIN tenants t ON t.tenant_id = o.tenant_id
                  WHERE o.order_id = ?`,
            args: [orderId]
        });

        if (orderRs.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orderRs.rows[0];

        // Clean both phone numbers to compare only digits
        const cleanInput = phone.replace(/\D/g, '');
        const cleanCustomer = (order.customer_phone || '').replace(/\D/g, '');

        if (!cleanInput || !cleanCustomer) {
            return res.status(403).json({ error: 'Incorrect phone number. Access denied.' });
        }

        // Match the last 10 digits (to handle country code prefix differences like 91 or +91)
        const inputSuffix = cleanInput.slice(-10);
        const customerSuffix = cleanCustomer.slice(-10);

        if (inputSuffix !== customerSuffix) {
            return res.status(403).json({ error: 'Incorrect phone number. Access denied.' });
        }

        // Fetch services
        const servicesRs = await db.execute({
            sql: 'SELECT service_type, quantity, price FROM services WHERE order_id = ?',
            args: [orderId]
        });

        // Return sanitized data (no internal IDs, tenant_id etc)
        res.json({
            order_id: order.order_id,
            order_number: order.order_number,
            status: order.status,
            booking_date: order.booking_date,
            delivery_date: order.delivery_date,
            total_amount: parseFloat(order.total_amount),
            advance_paid: parseFloat(order.advance_paid),
            balance_amount: parseFloat(order.balance_amount),
            notes: order.notes,
            created_at: order.created_at,
            customer_name: order.customer_name,
            shop_name: order.shop_name,
            shop_address: order.shop_address,
            shop_phone: order.shop_phone,
            shop_upi: order.shop_upi,
            services: servicesRs.rows.map(s => ({
                service_type: s.service_type,
                quantity: s.quantity,
                price: parseFloat(s.price)
            }))
        });

    } catch (err) {
        console.error('Track order error:', err);
        res.status(500).json({ error: 'Failed to fetch order details' });
    }
});

module.exports = router;
