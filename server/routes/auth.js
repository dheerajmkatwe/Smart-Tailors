const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const { db, checkPremiumStatus, getActiveBranchId } = require('../db');

// Helper to initialize Razorpay SDK client dynamically for tenant or fallback
async function getRazorpayClient(tenantId = null) {
    let keyId = process.env.RAZORPAY_KEY_ID;
    let keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (tenantId) {
        try {
            const rs = await db.execute({
                sql: 'SELECT razorpay_key_id, razorpay_key_secret FROM tenants WHERE tenant_id = ? LIMIT 1',
                args: [tenantId]
            });
            if (rs.rows.length > 0) {
                if (rs.rows[0].razorpay_key_id) keyId = rs.rows[0].razorpay_key_id;
                if (rs.rows[0].razorpay_key_secret) keySecret = rs.rows[0].razorpay_key_secret;
            }
        } catch (e) {
            console.error('Error fetching tenant razorpay keys:', e);
        }
    }

    keyId = keyId || 'rzp_live_Tdy6KkdIdRN0hJ';
    keySecret = keySecret || 'CHVoRAJD4dk2g8LhKOtPdar8';

    if (keyId && keySecret) {
        try {
            return {
                rzp: new Razorpay({ key_id: keyId, key_secret: keySecret }),
                keyId,
                keySecret
            };
        } catch (err) {
            console.error('Razorpay initialization error:', err);
        }
    }
    return { rzp: null, keyId, keySecret: keySecret || '' };
}


// Helper to generate a URL-friendly slug
function generateSlug(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

// POST /api/auth/register
// Onboard a new boutique/shop (Tenant)
router.post('/register', async (req, res) => {
    try {
        const { shop_name, admin_name, phone_number, address, password, shop_type, shop_logo } = req.body;

        if (!shop_name || !admin_name || !phone_number || !password) {
            return res.status(400).json({ error: 'Shop name, Admin name, Phone number, and Password are required' });
        }

        // Check if phone number is blocked
        const blockedCheck = await db.execute({
            sql: 'SELECT * FROM blocked_numbers WHERE phone_number = ? LIMIT 1',
            args: [phone_number.trim()]
        });
        if (blockedCheck.rows.length > 0) {
            return res.status(403).json({ error: 'This phone number has been blocked by system administrators. Registration denied.' });
        }

        // Check if phone number is already registered under any tenant
        const existingPhone = await db.execute({
            sql: 'SELECT tenant_id, shop_name FROM tenants WHERE phone_number = ? LIMIT 1',
            args: [phone_number.trim()]
        });
        if (existingPhone.rows.length > 0) {
            return res.status(400).json({ error: `An account with phone number ${phone_number.trim()} is already registered under "${existingPhone.rows[0].shop_name}". Please log in with your credentials.` });
        }

        // Generate a unique tenant ID slug
        let tenantId = generateSlug(shop_name);
        if (!tenantId) {
            tenantId = 'shop-' + Math.floor(1000 + Math.random() * 9000);
        }

        // Check if tenant ID already exists, if so append unique suffix
        const checkRs = await db.execute({
            sql: 'SELECT tenant_id FROM tenants WHERE tenant_id = ?',
            args: [tenantId]
        });
        if (checkRs.rows.length > 0) {
            tenantId = `${tenantId}-${Math.floor(1000 + Math.random() * 9000)}`;
        }

        // Insert new tenant shop with initial 30 days free trial expiration (ISO UTC format)
        const initialExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await db.execute({
            sql: `INSERT INTO tenants (tenant_id, shop_name, address, phone_number, admin_name, password, subscription_type, shop_type, shop_logo, subscription_expires_at) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [tenantId, shop_name, address || '', phone_number, admin_name, password, 'Free', shop_type || 'BOTH', shop_logo || null, initialExpiresAt]
        });

        res.status(201).json({
            success: true,
            tenant_id: tenantId,
            shop_name,
            admin_name,
            message: 'Shop successfully registered! You can now log in.'
        });
    } catch (err) {
        console.error('Registration error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/login
// Multi-tenant simplified authentication
router.post('/login', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (!username) {
            return res.status(400).json({ error: 'Shop username or registered phone is required' });
        }

        const input = username.trim();
        const activeTenantId = input.toUpperCase() === 'ADMIN' ? 'default' : input;

        // Retrieve tenant details using username OR phone number
        const tenantRs = await db.execute({
            sql: 'SELECT * FROM tenants WHERE tenant_id = ? OR phone_number = ? LIMIT 1',
            args: [activeTenantId, input]
        });

        if (tenantRs.rows.length === 0) {
            return res.status(404).json({ error: 'Shop credentials not found. Please verify.' });
        }

        const tenant = tenantRs.rows[0];

        // Check if phone number is blocked
        const blockedCheck = await db.execute({
            sql: 'SELECT * FROM blocked_numbers WHERE phone_number = ? LIMIT 1',
            args: [tenant.phone_number]
        });
        if (blockedCheck.rows.length > 0) {
            return res.status(403).json({ error: 'This account phone number has been blocked by system administrators. Access Denied.' });
        }

        // Check subscription expiration logic
        const now = new Date();
        let expiresAt;
        if (tenant.subscription_expires_at) {
            let s = String(tenant.subscription_expires_at).trim();
            if (s.includes(' ') && !s.includes('T')) s = s.replace(' ', 'T');
            if (!s.endsWith('Z') && !s.includes('+') && !s.includes('-')) s += 'Z';
            expiresAt = new Date(s);
        } else {
            const createdAt = new Date(tenant.created_at || Date.now());
            const days = tenant.subscription_type === 'Yearly' ? 365 : 30;
            expiresAt = new Date(createdAt.getTime() + days * 24 * 60 * 60 * 1000);
        }

        const isExpired = now > expiresAt;

        if (isExpired) {
            // Subscription Tiers:
            // Tier 1: Free (1st Month Trial) -> Expired -> Pay ₹1 for 30 days
            // Tier 2 & 3: Monthly or Yearly -> Expired -> Pay ₹9,999 for 365 days (repeats yearly)
            let nextPlan = 'Monthly';
            let amount = 1;
            let title = '1-Month Free Trial Expired 🔒';
            let message = 'Your 1-month free trial has expired. Please pay ₹1 and use the app for another 30 days.';

            if (tenant.subscription_type === 'Monthly' || tenant.subscription_type === 'Yearly') {
                nextPlan = 'Yearly';
                amount = 9999;
                title = 'Annual Subscription Required 🔒';
                message = 'Your 1-month trial access has ended. Please pay ₹9,999 to unlock all app features, orders, bills, and reports for the next 365 days.';
            }

            return res.status(403).json({
                error: message,
                trial_expired: true,
                shop_name: tenant.shop_name,
                tenant_id: tenant.tenant_id,
                phone_number: tenant.phone_number,
                admin_name: tenant.admin_name,
                upi_id: '9113565802@ibl',
                amount: amount,
                next_plan: nextPlan,
                title: title
            });
        }

        const isPremium = await checkPremiumStatus(tenant.tenant_id);

        if (role === 'Worker') {
            const { worker_name } = req.body;
            if (!worker_name || !worker_name.trim()) {
                return res.status(400).json({ error: 'Worker name is required for login' });
            }
            return res.json({
                role: 'Worker',
                name: worker_name.trim(),
                shop_name: tenant.shop_name,
                tenant_id: tenant.tenant_id,
                upi_id: tenant.upi_id || '',
                gst_id: tenant.gst_id || '',
                razorpay_key_id: tenant.razorpay_key_id || '',
                phone_number: tenant.phone_number || '',
                address: tenant.address || '',
                shop_type: tenant.shop_type || 'LADIES',
                shop_logo: tenant.shop_logo || '',
                isPremiumActive: isPremium,
                subscription_type: tenant.subscription_type || 'Free',
                created_at: tenant.created_at || null,
                subscription_expires_at: tenant.subscription_expires_at || null
            });
        }

        // Admin login requires password
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        if (password !== tenant.password) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        res.json({
            role: 'Admin',
            name: tenant.admin_name,
            shop_name: tenant.shop_name,
            tenant_id: tenant.tenant_id,
            upi_id: tenant.upi_id || '',
            gst_id: tenant.gst_id || '',
            razorpay_key_id: tenant.razorpay_key_id || '',
            phone_number: tenant.phone_number || '',
            address: tenant.address || '',
            shop_type: tenant.shop_type || 'LADIES',
            shop_logo: tenant.shop_logo || '',
            isPremiumActive: isPremium,
            subscription_type: tenant.subscription_type || 'Free',
            created_at: tenant.created_at || null,
            subscription_expires_at: tenant.subscription_expires_at || null
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/auth/shop/:tenantId
// Retrieve public details of a shop for confirmation
router.get('/shop/:tenantId', async (req, res) => {
    try {
        const rs = await db.execute({
            sql: 'SELECT shop_name, address, phone_number, admin_name FROM tenants WHERE tenant_id = ?',
            args: [req.params.tenantId]
        });
        if (rs.rows.length === 0) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        res.json(rs.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/auth/profile
// Retrieve active shop profile configuration (including UPI/GST)
router.get('/profile', async (req, res) => {
    try {
        const rs = await db.execute({
            sql: 'SELECT tenant_id, shop_name, address, phone_number, admin_name, upi_id, gst_id, razorpay_key_id, razorpay_key_secret, shop_logo FROM tenants WHERE tenant_id = ?',
            args: [req.tenantId]
        });
        if (rs.rows.length === 0) {
            return res.status(404).json({ error: 'Shop identity not found' });
        }
        const profile = rs.rows[0];
        // Premium gate: mask UPI ID for non-premium users
        const isPremium = await checkPremiumStatus(req.tenantId);
        if (!isPremium) {
            profile.upi_id = '';
        }
        res.json(profile);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/auth/premium-status
// Retrieve active shop subscription and trial verification
router.get('/premium-status', async (req, res) => {
    try {
        const isPremium = await checkPremiumStatus(req.tenantId);
        const rs = await db.execute({
            sql: 'SELECT subscription_type, created_at, subscription_expires_at FROM tenants WHERE tenant_id = ? LIMIT 1',
            args: [req.tenantId]
        });
        if (rs.rows.length === 0) {
            return res.status(404).json({ error: 'Shop identity not found' });
        }
        const tenant = rs.rows[0];
        res.json({
            isPremiumActive: isPremium,
            subscription_type: tenant.subscription_type || 'Free',
            created_at: tenant.created_at || new Date().toISOString(),
            subscription_expires_at: tenant.subscription_expires_at || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/auth/profile
// Update active shop profile configuration
router.put('/profile', async (req, res) => {
    try {
        const { shop_name, address, phone_number, admin_name, upi_id, gst_id, razorpay_key_id, razorpay_key_secret, shop_logo } = req.body;
        if (!shop_name || !admin_name) {
            return res.status(400).json({ error: 'Shop name and Admin name are required' });
        }

        // Only allow UPI ID to be saved for premium subscribers
        const isPremium = await checkPremiumStatus(req.tenantId);
        const safeUpiId = isPremium ? (upi_id || '') : '';

        await db.execute({
            sql: 'UPDATE tenants SET shop_name = ?, address = ?, phone_number = ?, admin_name = ?, upi_id = ?, gst_id = ?, razorpay_key_id = ?, razorpay_key_secret = ?, shop_logo = ? WHERE tenant_id = ?',
            args: [shop_name, address || '', phone_number || '', admin_name, safeUpiId, gst_id || '', razorpay_key_id || '', razorpay_key_secret || '', shop_logo || null, req.tenantId]
        });

        if (!isPremium && upi_id && upi_id.trim()) {
            return res.json({ success: true, message: 'Profile updated. Note: UPI ID was not saved — this feature requires a Premium subscription.' });
        }

        res.json({ success: true, message: 'Boutique profile updated successfully!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/auth/workers
// Fetch active workers assigned to the tenant
router.get('/workers', async (req, res) => {
    try {
        const bFilter = req.branchId && req.branchId !== 'all' ? ' AND branch_id = ?' : '';
        const bArgs = req.branchId && req.branchId !== 'all' ? [Number(req.branchId)] : [];
        const rs = await db.execute({
            sql: `SELECT * FROM workers WHERE tenant_id = ? AND is_active = 1${bFilter}`,
            args: [req.tenantId, ...bArgs]
        });
        res.json(rs.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/workers
// Add a stitching worker to the registry
router.post('/workers', async (req, res) => {
    try {
        const { name, phone_number } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Worker name is required' });
        }

        // Check how many workers exist BEFORE inserting (to detect first worker)
        const countRs = await db.execute({
            sql: 'SELECT COUNT(*) as cnt FROM workers WHERE tenant_id = ? AND is_active = 1',
            args: [req.tenantId]
        });
        const isFirstWorker = (countRs.rows[0]?.cnt || 0) === 0;

        const activeBranchId = await getActiveBranchId(req.tenantId, req.branchId);

        await db.execute({
            sql: 'INSERT INTO workers (tenant_id, name, phone_number, is_active, branch_id) VALUES (?, ?, ?, 1, ?)',
            args: [req.tenantId, name.trim(), phone_number || '', activeBranchId]
        });

        let backfilled = 0;
        // If this is the first worker, assign all unassigned orders to them
        if (isFirstWorker) {
            const backfillRs = await db.execute({
                sql: "UPDATE orders SET assigned_worker = ? WHERE tenant_id = ? AND (assigned_worker IS NULL OR assigned_worker = '')",
                args: [name.trim(), req.tenantId]
            });
            backfilled = backfillRs.rowsAffected || 0;
            if (backfilled > 0) {
                console.log(`✅ Backfilled ${backfilled} existing order(s) to first worker "${name.trim()}" for tenant "${req.tenantId}"`);
            }
        }

        res.json({
            success: true,
            message: 'Worker registered successfully!',
            backfilled_orders: backfilled
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/auth/workers/:id
// Soft-delete worker from active list
router.delete('/workers/:id', async (req, res) => {
    try {
        await db.execute({
            sql: 'UPDATE workers SET is_active = 0 WHERE id = ? AND tenant_id = ?',
            args: [req.params.id, req.tenantId]
        });
        res.json({ success: true, message: 'Worker removed successfully!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Branches CRUD Routes (Premium Feature) ───────────────────

// GET /api/auth/branches
router.get('/branches', async (req, res) => {
    try {
        const rs = await db.execute({
            sql: 'SELECT * FROM branches WHERE tenant_id = ? ORDER BY id ASC',
            args: [req.tenantId]
        });
        res.json(rs.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/branches
router.post('/branches', async (req, res) => {
    try {
        const { name, address, phone_number } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Branch name is required' });
        }
        
        const tenantRs = await db.execute({
            sql: 'SELECT subscription_type FROM tenants WHERE tenant_id = ? LIMIT 1',
            args: [req.tenantId]
        });
        const tenant = tenantRs.rows[0];
        const subscriptionType = tenant?.subscription_type || 'Free';
        
        if (subscriptionType !== 'Yearly') {
            const countRs = await db.execute({
                sql: 'SELECT COUNT(*) as count FROM branches WHERE tenant_id = ?',
                args: [req.tenantId]
            });
            if (Number(countRs.rows[0]?.count || 0) >= 1) {
                return res.status(403).json({
                    error: 'Yearly Subscription Required',
                    message: 'Multi-Branch & Chain Boutique Support is a premium feature exclusive to our Yearly Subscription plan. Please upgrade your subscription to enable multiple branch locations!'
                });
            }
        }
        
        await db.execute({
            sql: 'INSERT INTO branches (tenant_id, name, address, phone_number) VALUES (?, ?, ?, ?)',
            args: [req.tenantId, name.trim(), address || '', phone_number || '']
        });
        
        res.json({ success: true, message: 'Branch added successfully!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/auth/branches/:id
router.put('/branches/:id', async (req, res) => {
    try {
        const { name, address, phone_number } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Branch name is required' });
        }
        await db.execute({
            sql: 'UPDATE branches SET name = ?, address = ?, phone_number = ? WHERE id = ? AND tenant_id = ?',
            args: [name.trim(), address || '', phone_number || '', req.params.id, req.tenantId]
        });
        res.json({ success: true, message: 'Branch updated successfully!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/auth/branches/:id
router.delete('/branches/:id', async (req, res) => {
    try {
        const allBranches = await db.execute({
            sql: 'SELECT id FROM branches WHERE tenant_id = ? ORDER BY id ASC',
            args: [req.tenantId]
        });
        
        if (allBranches.rows.length <= 1) {
            return res.status(400).json({ error: 'Cannot delete the only remaining branch. A boutique must have at least one branch.' });
        }
        
        const deleteId = Number(req.params.id);
        const remaining = allBranches.rows.filter(b => Number(b.id) !== deleteId);
        
        if (remaining.length === 0) {
            return res.status(400).json({ error: 'Cannot delete the only branch.' });
        }
        
        const reassignId = remaining[0].id;
        
        // Reassign all branch records to the first remaining branch to prevent data loss
        const tablesToUpdate = ['orders', 'customers', 'expenses', 'alterations', 'workers'];
        for (const tbl of tablesToUpdate) {
            await db.execute({
                sql: `UPDATE ${tbl} SET branch_id = ? WHERE tenant_id = ? AND branch_id = ?`,
                args: [reassignId, req.tenantId, deleteId]
            });
        }
        
        await db.execute({
            sql: 'DELETE FROM branches WHERE id = ? AND tenant_id = ?',
            args: [deleteId, req.tenantId]
        });
        
        res.json({ success: true, message: 'Branch deleted successfully! All associated orders and records have been moved to your primary branch.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/send-otp
// Generate and simulate sending OTP based on Shop Username or Phone Number
router.post('/send-otp', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) {
            return res.status(400).json({ error: 'Shop username or registered phone is required' });
        }

        const input = username.trim();
        const activeTenantId = input.toUpperCase() === 'ADMIN' ? 'default' : input;

        // Search the tenants table to ensure a boutique exists with this username or phone number
        const tenantRs = await db.execute({
            sql: 'SELECT * FROM tenants WHERE tenant_id = ? OR phone_number = ? LIMIT 1',
            args: [activeTenantId, input]
        });

        if (tenantRs.rows.length === 0) {
            return res.status(404).json({ error: 'Shop credentials not found. Please verify.' });
        }

        const tenant = tenantRs.rows[0];
        const phone = tenant.phone_number;

        if (!phone) {
            return res.status(400).json({ error: 'No phone number is registered for this shop. Please log in with password to configure settings.' });
        }

        // Check if phone number is blocked
        const blockedCheck = await db.execute({
            sql: 'SELECT * FROM blocked_numbers WHERE phone_number = ? LIMIT 1',
            args: [phone]
        });
        if (blockedCheck.rows.length > 0) {
            return res.status(403).json({ error: 'This phone number has been blocked by system administrators. Access Denied.' });
        }

        // Generate a random 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min expiry

        // Store OTP in database, replacing any old ones
        await db.execute({
            sql: 'INSERT OR REPLACE INTO otps (phone, otp, expires_at) VALUES (?, ?, ?)',
            args: [phone, otp, expiresAt]
        });

        // Simulating WhatsApp OTP delivery: log clearly in the backend console for verification
        console.log(`\n💬 [WhatsApp OTP] TO: ${phone} (Shop: ${tenant.shop_name}) | VERIFICATION CODE: ${otp} | EXPIRES: 5 mins\n`);

        res.json({
            success: true,
            message: `Verification code successfully sent to WhatsApp registered under ${tenant.shop_name}!`,
            phone_masked: phone.slice(-4).padStart(phone.length, '*'),
            dev_otp: otp
        });
    } catch (err) {
        console.error('Send OTP error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/verify-otp
// Verify the WhatsApp OTP and login using Shop Username or Phone Number
router.post('/verify-otp', async (req, res) => {
    try {
        const { username, otp } = req.body;
        if (!username || !otp) {
            return res.status(400).json({ error: 'Shop credentials and verification code are required' });
        }

        const input = username.trim();
        const activeTenantId = input.toUpperCase() === 'ADMIN' ? 'default' : input;

        // Retrieve the corresponding tenant account
        const tenantRs = await db.execute({
            sql: 'SELECT * FROM tenants WHERE tenant_id = ? OR phone_number = ? LIMIT 1',
            args: [activeTenantId, input]
        });

        if (tenantRs.rows.length === 0) {
            return res.status(404).json({ error: 'Shop credentials not found.' });
        }

        const tenant = tenantRs.rows[0];
        const phone = tenant.phone_number;

        if (!phone) {
            return res.status(400).json({ error: 'No phone number is registered for this shop.' });
        }

        // Check if phone number is blocked
        const blockedCheck = await db.execute({
            sql: 'SELECT * FROM blocked_numbers WHERE phone_number = ? LIMIT 1',
            args: [phone]
        });
        if (blockedCheck.rows.length > 0) {
            return res.status(403).json({ error: 'This phone number has been blocked by system administrators. Access Denied.' });
        }

        // Retrieve OTP details from database
        const otpRs = await db.execute({
            sql: 'SELECT * FROM otps WHERE phone = ?',
            args: [phone]
        });

        if (otpRs.rows.length === 0) {
            return res.status(400).json({ error: 'Verification code not found. Please request a new one.' });
        }

        const record = otpRs.rows[0];

        // Check expiration
        if (new Date(record.expires_at) < new Date()) {
            await db.execute({ sql: 'DELETE FROM otps WHERE phone = ?', args: [phone] });
            return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
        }

        // Verify code match
        if (record.otp !== otp.trim()) {
            return res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
        }

        // Match successful! Consume the OTP
        await db.execute({ sql: 'DELETE FROM otps WHERE phone = ?', args: [phone] });

        // Return standard logged-in session payload
        res.json({
            role: 'Admin',
            name: tenant.admin_name,
            shop_name: tenant.shop_name,
            tenant_id: tenant.tenant_id,
            upi_id: tenant.upi_id || '',
            phone_number: tenant.phone_number || '',
            address: tenant.address || ''
        });
    } catch (err) {
        console.error('Verify OTP error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/auth/public/workers/:tenantIdOrPhone
// Retrieve public workers for selection during login
router.get('/public/workers/:tenantIdOrPhone', async (req, res) => {
    try {
        const input = req.params.tenantIdOrPhone.trim();
        const activeTenantId = input.toUpperCase() === 'ADMIN' ? 'default' : input;

        // Search the tenants table to ensure a boutique exists with this username or phone number
        const tenantRs = await db.execute({
            sql: 'SELECT tenant_id FROM tenants WHERE tenant_id = ? OR phone_number = ? LIMIT 1',
            args: [activeTenantId, input]
        });

        if (tenantRs.rows.length === 0) {
            return res.status(404).json({ error: 'Shop not found' });
        }

        const tenant = tenantRs.rows[0];

        const rs = await db.execute({
            sql: 'SELECT id, name FROM workers WHERE tenant_id = ? AND is_active = 1',
            args: [tenant.tenant_id]
        });
        res.json(rs.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/super-admin/login
// Log in the Super Admin using specific credentials
router.post('/super-admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const superAdminEmail = 'developerhubhai';
        const superAdminPassword = 'developerhubhai';

        if (!superAdminEmail || !superAdminPassword) {
            return res.status(500).json({ error: 'Super Admin credentials are not configured on the server.' });
        }

        if (username.trim().toLowerCase() === superAdminEmail.toLowerCase() && password === superAdminPassword) {
            return res.json({
                role: 'SuperAdmin',
                name: 'Kishan Magaji',
                email: superAdminEmail,
                token: 'super-admin-secret-session-token'
            });
        } else {
            return res.status(401).json({ error: 'Invalid super admin credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/auth/super-admin/tenants
// Retrieve all registered tenants for the super admin dashboard
router.get('/super-admin/tenants', async (req, res) => {
    try {
        const rs = await db.execute(`
            SELECT tenant_id, shop_name, address, phone_number, admin_name, gst_id, subscription_type, subscription_key, subscription_pin, pending_request_type, pending_request_date, created_at, subscription_expires_at,
            (SELECT COUNT(*) FROM orders WHERE orders.tenant_id = tenants.tenant_id) as total_orders,
            (SELECT COUNT(*) FROM customers WHERE customers.tenant_id = tenants.tenant_id) as total_customers
            FROM tenants 
            ORDER BY created_at DESC
        `);
        res.json(rs.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/super-admin/tenants/:tenant_id/subscription
// Update the subscription plan for a tenant, generating gift cards if applicable
router.post('/super-admin/tenants/:tenant_id/subscription', async (req, res) => {
    try {
        const { tenant_id } = req.params;
        const { subscription_type } = req.body;

        if (!['Free', 'New Free', 'Monthly', 'Yearly'].includes(subscription_type)) {
            return res.status(400).json({ error: 'Invalid subscription type' });
        }

        let subscription_key = null;
        let subscription_pin = null;

        if (subscription_type === 'Monthly' || subscription_type === 'Yearly') {
            // Generate a 12-character alphanumeric code
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            subscription_key = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
            
            // Generate a 6-digit PIN
            subscription_pin = Math.floor(100000 + Math.random() * 900000).toString();

            // Set keys, but DO NOT activate the subscription immediately. Leave current subscription_type,
            // and store the target plan in pending_request_type so they must activate it using the keys!
            await db.execute({
                sql: `UPDATE tenants 
                      SET subscription_key = ?, subscription_pin = ?, pending_request_type = ?, pending_request_date = datetime('now', 'localtime')
                      WHERE tenant_id = ?`,
                args: [subscription_key, subscription_pin, subscription_type, tenant_id]
            });
        } else {
            // Immediately downgrade or set to Free/New Free
            await db.execute({
                sql: `UPDATE tenants 
                      SET subscription_type = ?, subscription_key = NULL, subscription_pin = NULL, pending_request_type = NULL, pending_request_date = NULL 
                      WHERE tenant_id = ?`,
                args: [subscription_type, tenant_id]
            });
        }

        res.json({
            message: 'Subscription updated successfully',
            subscription_type,
            subscription_key,
            subscription_pin
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/request-subscription
// Set a pending subscription verification request for a tenant
router.post('/request-subscription', async (req, res) => {
    try {
        const { plan } = req.body;
        if (!['monthly', 'yearly'].includes(plan)) {
            return res.status(400).json({ error: 'Invalid subscription request type.' });
        }

        const type = plan === 'monthly' ? 'Monthly' : 'Yearly';

        await db.execute({
            sql: "UPDATE tenants SET pending_request_type = ?, pending_request_date = datetime('now', 'localtime') WHERE tenant_id = ?",
            args: [type, req.tenantId]
        });

        res.json({
            success: true,
            message: 'Your payment transaction request has been logged successfully.'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/activate-subscription
// Verify and activate a generated premium gift pass
router.post('/activate-subscription', async (req, res) => {
    try {
        const { key, pin } = req.body;
        if (!key || !pin) {
            return res.status(400).json({ error: 'Gift Pass Key and Security PIN are required.' });
        }

        const rs = await db.execute({
            sql: 'SELECT subscription_type, subscription_key, subscription_pin, pending_request_type FROM tenants WHERE tenant_id = ? LIMIT 1',
            args: [req.tenantId]
        });

        if (rs.rows.length === 0) {
            return res.status(404).json({ error: 'Shop identity not found.' });
        }

        const tenant = rs.rows[0];

        if (!tenant.subscription_key || !tenant.subscription_pin) {
            return res.status(400).json({ error: 'No pending Gift Pass was found for this boutique. Please contact Kishan Magaji.' });
        }

        if (tenant.subscription_key !== key.trim().toUpperCase() || tenant.subscription_pin !== pin.trim()) {
            return res.status(400).json({ error: 'Invalid Gift Pass Key or Security PIN. Verification failed.' });
        }

        // Successfully verified! Retrieve target plan from pending_request_type
        const targetPlan = tenant.pending_request_type || 'Monthly';

        // Clear keys/pending status and officially set the active subscription_type
        await db.execute({
            sql: 'UPDATE tenants SET subscription_type = ?, subscription_key = NULL, subscription_pin = NULL, pending_request_type = NULL, pending_request_date = NULL WHERE tenant_id = ?',
            args: [targetPlan, req.tenantId]
        });

        res.json({
            success: true,
            message: 'Congratulations! Your Premium Smart Pass has been successfully activated. Enjoy full premium features!',
            subscription_type: targetPlan
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/auth/super-admin/tenants/:tenant_id
// Delete a tenant boutique and completely clean all related records
router.delete('/super-admin/tenants/:tenant_id', async (req, res) => {
    try {
        const { tenant_id } = req.params;
        if (tenant_id === 'default') {
            return res.status(400).json({ error: 'Cannot delete the default seed tenant.' });
        }

        console.log(`🧹 Deleting tenant: ${tenant_id} and all related records...`);

        // Batch delete to avoid constraint or reference errors and keep DB absolutely pristine
        await db.batch([
            {
                sql: `DELETE FROM order_images WHERE order_id IN (SELECT order_id FROM orders WHERE tenant_id = ?)`,
                args: [tenant_id]
            },
            {
                sql: `DELETE FROM order_voice_notes WHERE order_id IN (SELECT order_id FROM orders WHERE tenant_id = ?)`,
                args: [tenant_id]
            },
            {
                sql: `DELETE FROM services WHERE order_id IN (SELECT order_id FROM orders WHERE tenant_id = ?)`,
                args: [tenant_id]
            },
            {
                sql: `DELETE FROM orders WHERE tenant_id = ?`,
                args: [tenant_id]
            },
            {
                sql: `DELETE FROM measurements WHERE customer_id IN (SELECT id FROM customers WHERE tenant_id = ?)`,
                args: [tenant_id]
            },
            {
                sql: `DELETE FROM customers WHERE tenant_id = ?`,
                args: [tenant_id]
            },
            {
                sql: `DELETE FROM expenses WHERE tenant_id = ?`,
                args: [tenant_id]
            },
            {
                sql: `DELETE FROM alterations WHERE tenant_id = ?`,
                args: [tenant_id]
            },
            {
                sql: `DELETE FROM workers WHERE tenant_id = ?`,
                args: [tenant_id]
            },
            {
                sql: `DELETE FROM tenants WHERE tenant_id = ?`,
                args: [tenant_id]
            }
        ], "write");

        res.json({ success: true, message: `Boutique account ${tenant_id} and all related records have been deleted.` });
    } catch (err) {
        console.error('Error deleting tenant:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/auth/super-admin/blocked-numbers
// Fetch all blocked numbers for the super admin
router.get('/super-admin/blocked-numbers', async (req, res) => {
    try {
        const rs = await db.execute('SELECT * FROM blocked_numbers ORDER BY created_at DESC');
        res.json(rs.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/super-admin/blocked-numbers
// Block a specific phone number from registering or logging in
router.post('/super-admin/blocked-numbers', async (req, res) => {
    try {
        const { phone_number, reason } = req.body;
        if (!phone_number) {
            return res.status(400).json({ error: 'Phone number is required.' });
        }
        await db.execute({
            sql: 'INSERT OR REPLACE INTO blocked_numbers (phone_number, reason) VALUES (?, ?)',
            args: [phone_number.trim(), reason || '']
        });
        res.json({ success: true, message: `Phone number ${phone_number} successfully blocked.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/auth/super-admin/blocked-numbers/:phone_number
// Unblock a specific phone number
router.delete('/super-admin/blocked-numbers/:phone_number', async (req, res) => {
    try {
        const { phone_number } = req.params;
        await db.execute({
            sql: 'DELETE FROM blocked_numbers WHERE phone_number = ?',
            args: [phone_number.trim()]
        });
        res.json({ success: true, message: `Phone number ${phone_number} successfully unblocked.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/super-admin/set-trial-duration
// Set or decrease trial duration for a specific boutique user (e.g., 2 mins, 5 mins, 10 mins, etc.)
router.post('/super-admin/set-trial-duration', async (req, res) => {
    try {
        const { tenant_id, duration_minutes } = req.body;
        if (!tenant_id || duration_minutes === undefined || duration_minutes === null) {
            return res.status(400).json({ error: 'tenant_id and duration_minutes are required.' });
        }

        const mins = parseFloat(duration_minutes);
        if (isNaN(mins) || mins < 0) {
            return res.status(400).json({ error: 'Invalid trial duration specified.' });
        }

        const tenantRs = await db.execute({
            sql: 'SELECT * FROM tenants WHERE tenant_id = ? LIMIT 1',
            args: [tenant_id]
        });

        if (tenantRs.rows.length === 0) {
            return res.status(404).json({ error: 'Shop identity not found.' });
        }

        const tenant = tenantRs.rows[0];

        // Calculate new expiration ISO timestamp from current server time
        const newExpiresAt = new Date(Date.now() + mins * 60 * 1000).toISOString();

        await db.execute({
            sql: `UPDATE tenants 
                  SET subscription_expires_at = ?,
                      subscription_type = 'Free'
                  WHERE tenant_id = ?`,
            args: [newExpiresAt, tenant_id]
        });

        console.log(`⏱️ Super Admin set custom trial duration for shop "${tenant.shop_name}" (${tenant_id}) -> ${mins} minutes (Expires: ${newExpiresAt})`);

        res.json({
            success: true,
            message: `🎉 Trial duration updated to ${mins} minute(s) for "${tenant.shop_name}".`,
            tenant_id,
            subscription_expires_at: newExpiresAt,
            subscription_type: 'Free'
        });
    } catch (err) {
        console.error('Error updating custom trial duration:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/razorpay-create-order
// Create Razorpay Order for automated GST checkout
router.post('/razorpay-create-order', async (req, res) => {
    try {
        const { plan } = req.body;
        if (plan !== 'monthly' && plan !== 'yearly') {
            return res.status(400).json({ error: 'Invalid plan type specified.' });
        }
        const amount = plan === 'monthly' ? 25000 : 200000;
        const currency = 'INR';

        const { rzp, keyId } = await getRazorpayClient(req.tenantId);
        let orderId;

        if (rzp) {
            const order = await rzp.orders.create({
                amount: amount,
                currency: currency,
                receipt: `rcpt_sub_${Date.now()}`
            });
            orderId = order.id;
        } else {
            orderId = 'order_' + require('crypto').randomBytes(8).toString('hex');
        }

        res.json({
            success: true,
            order_id: orderId,
            amount: amount,
            currency: currency,
            key: keyId
        });
    } catch (err) {
        console.error('Razorpay create order error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/razorpay-verify-payment
// Automatically verify payment signature and activate premium subscription
router.post('/razorpay-verify-payment', async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, plan } = req.body;
        const { keySecret } = await getRazorpayClient(req.tenantId);

        if (keySecret && razorpay_order_id && razorpay_signature) {
            const crypto = require('crypto');
            const expectedSignature = crypto
                .createHmac('sha256', keySecret)
                .update(razorpay_order_id + '|' + razorpay_payment_id)
                .digest('hex');

            if (expectedSignature !== razorpay_signature) {
                return res.status(400).json({ error: 'Invalid payment signature. Transaction verification failed.' });
            }
        }

        const subscriptionType = plan === 'yearly' ? 'Yearly' : 'Monthly';
        const subDays = plan === 'yearly' ? 365 : 30;
        const subExpiresAt = new Date(Date.now() + subDays * 24 * 60 * 60 * 1000).toISOString();

        await db.execute({
            sql: `UPDATE tenants 
                  SET subscription_type = ?,
                      subscription_expires_at = ?
                  WHERE tenant_id = ?`,
            args: [subscriptionType, subExpiresAt, req.tenantId]
        });

        res.json({
            success: true,
            subscription_type: subscriptionType,
            message: 'Payment verified and Premium Activated automatically via Razorpay!'
        });
    } catch (err) {
        console.error('Razorpay verify payment error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/razorpay-create-advance-order
// Create Razorpay Order for customer advance payment
router.post('/razorpay-create-advance-order', async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid advance payment amount specified.' });
        }
        const amountPaise = Math.round(amount * 100);
        const currency = 'INR';

        const { rzp, keyId } = await getRazorpayClient(req.tenantId);
        let orderId;

        if (rzp) {
            const order = await rzp.orders.create({
                amount: amountPaise,
                currency: currency,
                receipt: `rcpt_adv_${Date.now()}`
            });
            orderId = order.id;
        } else {
            orderId = 'order_adv_' + require('crypto').randomBytes(8).toString('hex');
        }

        res.json({
            success: true,
            order_id: orderId,
            amount: amountPaise,
            currency: currency,
            key: keyId
        });
    } catch (err) {
        console.error('Razorpay create advance order error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/razorpay-verify-advance-payment
// Automatically verify payment signature for customer advance payment
router.post('/razorpay-verify-advance-payment', async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
        const { keySecret } = await getRazorpayClient(req.tenantId);

        if (keySecret && razorpay_order_id && razorpay_signature) {
            const crypto = require('crypto');
            const expectedSignature = crypto
                .createHmac('sha256', keySecret)
                .update(razorpay_order_id + '|' + razorpay_payment_id)
                .digest('hex');

            if (expectedSignature !== razorpay_signature) {
                return res.status(400).json({ error: 'Invalid payment signature. Transaction verification failed.' });
            }
        }

        res.json({
            success: true,
            message: 'Advance payment verified successfully via Razorpay!',
            payment_id: razorpay_payment_id
        });
    } catch (err) {
        console.error('Razorpay verify advance error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/renew-subscription
// Renew or extend boutique subscription based on current plan tier (Monthly ₹1 / 30 days OR Yearly ₹9,999 / 365 days)
router.post('/renew-subscription', async (req, res) => {
    try {
        const { tenant_id, plan, payment_ref } = req.body;
        if (!tenant_id) {
            return res.status(400).json({ error: 'Shop Username / Tenant ID is required' });
        }

        const tenantRs = await db.execute({
            sql: 'SELECT * FROM tenants WHERE tenant_id = ? OR phone_number = ? LIMIT 1',
            args: [tenant_id.trim(), tenant_id.trim()]
        });

        if (tenantRs.rows.length === 0) {
            return res.status(404).json({ error: 'Shop identity not found' });
        }

        const tenant = tenantRs.rows[0];

        // Determine plan tier:
        // If current subscription is 'Free' -> upgrade to 'Monthly' (+30 days)
        // If current subscription is 'Monthly' or 'Yearly' -> upgrade to 'Yearly' (+365 days)
        let targetPlan = plan;
        if (!targetPlan) {
            targetPlan = tenant.subscription_type === 'Free' ? 'Monthly' : 'Yearly';
        }

        const subDays = targetPlan === 'Yearly' ? 365 : 30;
        const subExpiresAt = new Date(Date.now() + subDays * 24 * 60 * 60 * 1000).toISOString();
        const nowIso = new Date().toISOString();

        await db.execute({
            sql: `UPDATE tenants 
                  SET subscription_type = ?,
                      subscription_expires_at = ?,
                      created_at = ?,
                      pending_request_type = NULL,
                      pending_request_date = NULL
                  WHERE tenant_id = ?`,
            args: [targetPlan, subExpiresAt, nowIso, tenant.tenant_id]
        });

        console.log(`✅ Subscription renewed for shop "${tenant.shop_name}" (${tenant.tenant_id}) -> Plan: ${targetPlan} (${durationModifier})`);

        res.json({
            success: true,
            message: targetPlan === 'Yearly'
                ? '🎉 Annual Subscription Renewed! You can now log in with your credentials and use all app features for the next 365 days.'
                : '🎉 Subscription Renewed! You can now log in with your credentials and use all app features for another 30 days.',
            tenant_id: tenant.tenant_id,
            shop_name: tenant.shop_name,
            subscription_type: targetPlan
        });
    } catch (err) {
        console.error('Renewal error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/razorpay-create-subscription-order
// Generate dynamic Razorpay order for subscription renewal (₹1 or ₹9,999)
router.post('/razorpay-create-subscription-order', async (req, res) => {
    try {
        const { tenant_id, amount, plan } = req.body;
        if (!tenant_id || !amount) {
            return res.status(400).json({ error: 'Shop ID and amount are required' });
        }

        const amountPaise = Math.round(parseFloat(amount) * 100);
        const currency = 'INR';

        const { rzp, keyId } = await getRazorpayClient(tenant_id);
        let orderId;

        if (rzp) {
            const order = await rzp.orders.create({
                amount: amountPaise,
                currency: currency,
                receipt: `rcpt_renew_${Date.now()}`
            });
            orderId = order.id;
        } else {
            orderId = 'order_sub_' + require('crypto').randomBytes(8).toString('hex');
        }

        res.json({
            success: true,
            order_id: orderId,
            amount: amountPaise,
            currency: currency,
            key: keyId
        });
    } catch (err) {
        console.error('Razorpay create subscription order error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/razorpay-verify-subscription-payment
// Automatically verify payment signature and activate subscription (+30 days for ₹1, +365 days for ₹9,999)
router.post('/razorpay-verify-subscription-payment', async (req, res) => {
    try {
        const { tenant_id, plan, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
        if (!tenant_id) {
            return res.status(400).json({ error: 'Shop ID is required' });
        }

        const { keySecret } = await getRazorpayClient(tenant_id);

        if (keySecret && razorpay_order_id && razorpay_signature) {
            const crypto = require('crypto');
            const expectedSignature = crypto
                .createHmac('sha256', keySecret)
                .update(razorpay_order_id + '|' + razorpay_payment_id)
                .digest('hex');

            if (expectedSignature !== razorpay_signature) {
                return res.status(400).json({ error: 'Invalid payment signature. Transaction verification failed.' });
            }
        }

        const targetPlan = plan || 'Monthly';
        const subDays = targetPlan === 'Yearly' ? 365 : 30;
        const subExpiresAt = new Date(Date.now() + subDays * 24 * 60 * 60 * 1000).toISOString();
        const nowIso = new Date().toISOString();

        await db.execute({
            sql: `UPDATE tenants 
                  SET subscription_type = ?,
                      subscription_expires_at = ?,
                      created_at = ?,
                      pending_request_type = NULL,
                      pending_request_date = NULL
                  WHERE tenant_id = ?`,
            args: [targetPlan, subExpiresAt, nowIso, tenant_id]
        });

        console.log(`✅ Razorpay payment verified & subscription active for shop (${tenant_id}) -> Plan: ${targetPlan}`);

        res.json({
            success: true,
            message: targetPlan === 'Yearly'
                ? '🎉 Payment Verified! Annual Subscription active for 365 days.'
                : '🎉 Payment Verified! Subscription active for 30 days.',
            tenant_id,
            subscription_type: targetPlan
        });
    } catch (err) {
        console.error('Razorpay verification error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
