const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');

// In-memory cache for QR status polling (qr_id => status object)
const qrStore = new Map();

// Helper to get Razorpay instance
function getRazorpayInstance() {
    const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_fallback';
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_fallback';
    return new Razorpay({ key_id, key_secret });
}

/**
 * POST /api/razorpay/create-dynamic-qr
 * Creates a single-use Razorpay Dynamic UPI QR code with a 15-minute TTL.
 */
router.post('/create-dynamic-qr', async (req, res) => {
    try {
        const { amount, shopName, note, customerName, orderId } = req.body;
        const tenantId = req.tenantId || 'default';
        const numAmount = Math.max(1, Math.round(Number(amount || 0)));

        const razorpay = getRazorpayInstance();
        
        // Expiry timestamp: 15 minutes from now in seconds
        const closeBy = Math.floor(Date.now() / 1000) + 15 * 60;

        let qrCodeData;
        try {
            // Attempt Razorpay SDK QR Creation
            qrCodeData = await razorpay.qrCode.create({
                type: 'upi_qr',
                name: (shopName || 'Boutique').substring(0, 40),
                usage: 'single_use',
                fixed_amount: true,
                payment_amount: numAmount * 100, // Razorpay takes amount in paise (1 INR = 100 paise)
                description: (note || 'Order Payment').substring(0, 40),
                close_by: closeBy,
                notes: {
                    tenant_id: tenantId,
                    customer_name: customerName || '',
                    order_id: orderId || ''
                }
            });
        } catch (sdkErr) {
            console.warn('⚠️ Razorpay SDK QR creation fallback (Test/Local Mode):', sdkErr.message);
            // Fallback for test mode or invalid keys
            const dummyId = `qr_test_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            qrCodeData = {
                id: dummyId,
                entity: 'qr_code',
                status: 'active',
                payment_url: `upi://pay?pa=9113565802@ibl&pn=${encodeURIComponent(shopName || 'Boutique')}&am=${numAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note || 'Order Payment')}`,
                image_url: null,
                close_by: closeBy
            };
        }

        // Store initial QR status
        qrStore.set(qrCodeData.id, {
            status: 'active',
            amount: numAmount,
            tenant_id: tenantId,
            createdAt: new Date().toISOString(),
            payment_url: qrCodeData.payment_url,
            image_url: qrCodeData.image_url
        });

        res.json({
            success: true,
            qr_id: qrCodeData.id,
            payment_url: qrCodeData.payment_url,
            image_url: qrCodeData.image_url,
            amount: numAmount,
            close_by: qrCodeData.close_by
        });

    } catch (err) {
        console.error('Create Dynamic QR error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/razorpay/qr-status/:qrId
 * Polls payment status for a specific QR code.
 */
router.get('/qr-status/:qrId', async (req, res) => {
    try {
        const { qrId } = req.params;
        let cached = qrStore.get(qrId);

        if (cached && cached.status === 'paid') {
            return res.json({ status: 'paid', payment_details: cached.payment_details || {} });
        }

        // Query Razorpay API if live key is configured
        if (process.env.RAZORPAY_KEY_ID && !qrId.startsWith('qr_test_')) {
            try {
                const razorpay = getRazorpayInstance();
                const fetched = await razorpay.qrCode.fetch(qrId);
                if (fetched && (fetched.status === 'closed' || fetched.payments_amount_received > 0)) {
                    const statusObj = {
                        status: 'paid',
                        amount: (fetched.payments_amount_received || 0) / 100,
                        paidAt: new Date().toISOString()
                    };
                    qrStore.set(qrId, statusObj);
                    return res.json({ status: 'paid', payment_details: statusObj });
                }
            } catch (fetchErr) {
                // Ignore API fetch errors in status polling
            }
        }

        res.json({ status: cached ? cached.status : 'active' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/razorpay/webhook
 * Listens for automatic payment webhooks from Razorpay.
 */
router.post('/webhook', (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (secret) {
            const shasum = crypto.createHmac('sha256', secret);
            shasum.update(JSON.stringify(req.body));
            const digest = shasum.digest('hex');
            const signature = req.headers['x-razorpay-signature'];
            if (digest !== signature) {
                return res.status(400).json({ error: 'Invalid webhook signature' });
            }
        }

        const event = req.body.event;
        const payload = req.body.payload;

        if (event === 'payment.captured' || event === 'payment.authorized' || event === 'qr_code.credited' || event === 'order.paid') {
            const qrEntity = payload.qr_code?.entity || payload.payment?.entity;
            const qrId = qrEntity?.id || qrEntity?.qr_code_id || payload.payment?.entity?.description;
            if (qrId) {
                qrStore.set(qrId, {
                    status: 'paid',
                    amount: (payload.payment?.entity?.amount || 0) / 100,
                    payment_id: payload.payment?.entity?.id,
                    paidAt: new Date().toISOString()
                });
                console.log(`✅ Razorpay Webhook [${event}]: Payment ${qrId} marked PAID automatically!`);
            }
        }


        res.json({ status: 'ok' });
    } catch (err) {
        console.error('Razorpay webhook error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/razorpay/simulate-payment
 * Dev/Testing endpoint to instantly mark a QR as paid.
 */
router.post('/simulate-payment', (req, res) => {
    const { qrId } = req.body;
    if (!qrId) return res.status(400).json({ error: 'qrId is required' });

    qrStore.set(qrId, {
        status: 'paid',
        payment_id: `pay_simulated_${Date.now()}`,
        paidAt: new Date().toISOString()
    });

    res.json({ success: true, message: `Simulated payment recorded for ${qrId}` });
});

module.exports = router;
