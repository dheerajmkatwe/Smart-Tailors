const { createClient } = require('@libsql/client');
const path = require('path');
require('dotenv').config();

// If DATABASE_URL starts with 'libsql://', it's Cloud (Turso)
// If it's empty, we use a local file
// For local development, use a simple file name
// For cloud, use the full libsql:// URL
const url = process.env.DATABASE_URL || "file:./lm_tailor.db";
const isLocal = url.startsWith('file:');

console.log('🔗 Connecting to:', url);

const db = createClient({
  url: url,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function initDB() {
  try {
    console.log('⏳ Running DB migration batch...');
    await db.batch([
      `CREATE TABLE IF NOT EXISTS tenants (
        tenant_id TEXT PRIMARY KEY,
        shop_name TEXT NOT NULL,
        address TEXT,
        phone_number TEXT NOT NULL,
        admin_name TEXT NOT NULL,
        password TEXT,
        upi_id TEXT,
        gst_id TEXT,
        subscription_type TEXT DEFAULT 'Free',
        subscription_key TEXT,
        subscription_pin TEXT,
        shop_type TEXT DEFAULT 'LADIES',
        shop_logo TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      )`,
      `CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        UNIQUE(tenant_id, phone_number)
      )`,
      `CREATE TABLE IF NOT EXISTS measurements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        meas_length REAL,
        length REAL,
        shoulder REAL,
        chest REAL,
        waist REAL,
        dot REAL,
        back_neck REAL,
        front_neck REAL,
        sleeves_length REAL,
        armhole REAL,
        chest_distance REAL,
        sleeves_round REAL,
        extra_measurements TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS orders (
        order_id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        customer_id INTEGER NOT NULL,
        booking_date TEXT NOT NULL,
        delivery_date TEXT NOT NULL,
        total_amount REAL NOT NULL DEFAULT 0,
        advance_paid REAL NOT NULL DEFAULT 0,
        balance_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Ready', 'Delivered')),
        measurement_type TEXT NOT NULL DEFAULT 'Body',
        notes TEXT,
        delivered_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS services (
        service_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        service_type TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        price REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS order_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        image_data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      )`,
      `CREATE TABLE IF NOT EXISTS order_voice_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        audio_data TEXT NOT NULL,
        duration INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS alterations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        date TEXT NOT NULL,
        total_alterations INTEGER NOT NULL DEFAULT 1,
        amount_received REAL NOT NULL DEFAULT 0,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      )`,
      `CREATE TABLE IF NOT EXISTS workers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone_number TEXT,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS otps (
        phone TEXT PRIMARY KEY,
        otp TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS blocked_numbers (
        phone_number TEXT PRIMARY KEY,
        reason TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      )`,
      `CREATE TABLE IF NOT EXISTS order_embroidery (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        work_type TEXT NOT NULL,
        embellishments TEXT,
        matching_colors TEXT,
        placement_area TEXT,
        neck_depth REAL,
        work_area_size TEXT,
        reference_image TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
      )`
    ], "write");
    console.log('✅ Table creation successful');

    // Migration to remove global UNIQUE from customers.phone_number and change to composite UNIQUE(tenant_id, phone_number)
    try {
      const tableInfo = await db.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='customers'");
      if (tableInfo.rows.length > 0) {
        const sql = tableInfo.rows[0].sql;
        // Normalize whitespaces and lowercase for safe checks
        const normalizedSql = sql.replace(/\s+/g, ' ').toLowerCase();
        
        // If it doesn't have the composite unique constraint, or if it still has a global UNIQUE constraint on phone_number
        const hasCompositeUnique = normalizedSql.includes('unique(tenant_id, phone_number)') || 
                                   normalizedSql.includes('unique(tenant_id,phone_number)');
        const hasGlobalUnique = normalizedSql.includes('phone_number text not null unique') || 
                                normalizedSql.includes('phone_number text unique not null') || 
                                normalizedSql.includes('phone_number text unique');

        if (!hasCompositeUnique || hasGlobalUnique) {
          console.log('⏳ Migrating customers table to remove global UNIQUE constraint...');
          
          // Drop existing unique indexes to prevent conflict
          try { await db.execute("DROP INDEX IF EXISTS idx_customers_phone"); } catch(e) {}
          try { await db.execute("DROP INDEX IF EXISTS idx_customers_phone_unique"); } catch(e) {}
          try { await db.execute("DROP INDEX IF EXISTS idx_customers_tenant"); } catch(e) {}

          // Create temp table with composite UNIQUE constraint
          await db.execute(`
            CREATE TABLE IF NOT EXISTS customers_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              tenant_id TEXT NOT NULL DEFAULT 'default',
              name TEXT NOT NULL,
              phone_number TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
              branch_id INTEGER,
              UNIQUE(tenant_id, phone_number)
            )
          `);
          
          // Migrate data safely
          await db.execute(`
            INSERT OR IGNORE INTO customers_new (id, tenant_id, name, phone_number, created_at, branch_id)
            SELECT id, tenant_id, name, phone_number, created_at, branch_id FROM customers
          `);
          
          // Drop old table
          await db.execute(`DROP TABLE customers`);
          
          // Rename new table
          await db.execute(`ALTER TABLE customers_new RENAME TO customers`);
          console.log('✅ Migrated customers table successfully!');
        }
      }
    } catch (migErr) {
      console.error('❌ Failed migrating customers table:', migErr.message);
    }

    // Migration to add password column if not exists
    try {
      await db.execute('ALTER TABLE tenants ADD COLUMN password TEXT');
      console.log('✅ Added password column to tenants table');
    } catch (e) {}

    // Migration to add upi_id and gst_id to tenants if they don't exist
    try {
      await db.execute('ALTER TABLE tenants ADD COLUMN upi_id TEXT');
      console.log('✅ Added upi_id column to tenants table');
    } catch (e) {}
    try {
      await db.execute('ALTER TABLE tenants ADD COLUMN gst_id TEXT');
      console.log('✅ Added gst_id column to tenants table');
    } catch (e) {}
    try {
      await db.execute('ALTER TABLE tenants ADD COLUMN razorpay_key_id TEXT');
      console.log('✅ Added razorpay_key_id column to tenants table');
    } catch (e) {}
    try {
      await db.execute('ALTER TABLE tenants ADD COLUMN razorpay_key_secret TEXT');
      console.log('✅ Added razorpay_key_secret column to tenants table');
    } catch (e) {}

    // Add subscription columns
    try {
      await db.execute("ALTER TABLE tenants ADD COLUMN subscription_type TEXT DEFAULT 'Free'");
      console.log('✅ Added subscription_type column to tenants table');
    } catch (e) {}
    try {
      await db.execute("ALTER TABLE tenants ADD COLUMN subscription_key TEXT");
      console.log('✅ Added subscription_key column to tenants table');
    } catch (e) {}
    try {
      await db.execute("ALTER TABLE tenants ADD COLUMN subscription_pin TEXT");
      console.log('✅ Added subscription_pin column to tenants table');
    } catch (e) {}
    try {
      await db.execute("ALTER TABLE tenants ADD COLUMN pending_request_type TEXT");
      console.log('✅ Added pending_request_type column to tenants table');
    } catch (e) {}
    try {
      await db.execute("ALTER TABLE tenants ADD COLUMN pending_request_date TEXT");
      console.log('✅ Added pending_request_date column to tenants table');
    } catch (e) {}

    // Seed default tenant (disabled to prevent it from automatically reappearing)
    // try {
    //   await db.execute(`
    //     INSERT OR IGNORE INTO tenants (tenant_id, shop_name, address, phone_number, admin_name, password, upi_id)
    //     VALUES ('default', 'SMART TAILOR', '', '', 'SMART', 'LataMagaji', '')
    //   `);
    //   console.log('✅ Seeded default tenant');
    // } catch (e) {
    //   console.error('❌ Failed to seed default tenant:', e.message);
    // }

    // Migration to add tenant_id to existing tables if they don't have it
    const tablesToMigrate = ['customers', 'orders', 'expenses', 'alterations'];
    for (const tbl of tablesToMigrate) {
      try {
        await db.execute(`ALTER TABLE ${tbl} ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default'`);
        console.log(`✅ Added tenant_id column to ${tbl} table`);
      } catch (e) {
        // Ignored if column already exists
      }
    }

    // Create indexes now that all columns are guaranteed to exist
    try {
      await db.batch([
        `CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)`,
        `CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number)`,
        `CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id, phone_number)`,
        `CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id)`,
        `CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders(delivery_date)`,
        `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`,
        `CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)`,
        `CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id, status)`,
        `CREATE INDEX IF NOT EXISTS idx_services_order_id ON services(order_id)`,
        `CREATE INDEX IF NOT EXISTS idx_services_service_type ON services(service_type)`,
        `CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)`,
        `CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)`,
        `CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_alterations_date ON alterations(date)`,
        `CREATE INDEX IF NOT EXISTS idx_alterations_tenant ON alterations(tenant_id)`
      ], "write");
      console.log('✅ Created all database indexes successfully');
    } catch (e) {
      console.error('❌ Failed to create indexes:', e.message);
    }

    // Rename/Add length column properly
    try {
      await db.execute('ALTER TABLE measurements ADD COLUMN meas_length REAL');
      console.log('✅ Added meas_length column to measurements table');
    } catch (e) { }
    try {
      await db.execute('ALTER TABLE measurements ADD COLUMN length REAL');
      console.log('✅ Added length column to measurements table');
    } catch (e) { }

    // Add measurement_type to existing orders table if it doesn't exist
    try {
      await db.execute('ALTER TABLE orders ADD COLUMN measurement_type TEXT NOT NULL DEFAULT "Body"');
      console.log('✅ Added measurement_type column to orders table');
    } catch (e) {}

    try {
      await db.execute('ALTER TABLE measurements ADD COLUMN chest_distance REAL');
      console.log('✅ Added chest_distance column to measurements table');
    } catch (e) { }
    try {
      await db.execute('ALTER TABLE measurements ADD COLUMN sleeves_round REAL');
      console.log('✅ Added sleeves_round column to measurements table');
    } catch (e) { }

    // Add assigned_worker and stitching_expense to orders table
    try {
      await db.execute('ALTER TABLE orders ADD COLUMN assigned_worker TEXT');
      console.log('✅ Added assigned_worker column to orders table');
    } catch (e) { }
    try {
      await db.execute('ALTER TABLE orders ADD COLUMN stitching_expense REAL NOT NULL DEFAULT 0');
      console.log('✅ Added stitching_expense column to orders table');
    } catch (e) { }
    try {
      await db.execute('ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT "Cash"');
      console.log('✅ Added payment_method column to orders table');
    } catch (e) { }

    try {
      await db.execute('ALTER TABLE orders ADD COLUMN order_number INTEGER');
      console.log('✅ Added order_number column to orders table');
    } catch (e) { }

    try {
      await db.execute('CREATE INDEX IF NOT EXISTS idx_orders_tenant_order_number ON orders(tenant_id, order_number)');
      console.log('✅ Created index on tenant_id and order_number columns');
    } catch (e) { }

    // Backfill order_number sequentially per tenant for any orders where it is NULL
    try {
      const nullRs = await db.execute('SELECT order_id, tenant_id FROM orders WHERE order_number IS NULL ORDER BY order_id ASC');
      if (nullRs.rows.length > 0) {
        console.log(`⏳ Backfilling order_number for ${nullRs.rows.length} existing orders...`);
        // Get the current max order_number per tenant
        const maxRs = await db.execute('SELECT tenant_id, MAX(order_number) as max_num FROM orders WHERE order_number IS NOT NULL GROUP BY tenant_id');
        const counters = {};
        for (const row of maxRs.rows) {
          counters[row.tenant_id] = row.max_num || 0;
        }

        const batchUpdates = [];
        for (const row of nullRs.rows) {
          const tenantId = row.tenant_id || 'default';
          if (!counters[tenantId]) {
            counters[tenantId] = 0;
          }
          counters[tenantId]++;
          batchUpdates.push({
            sql: 'UPDATE orders SET order_number = ? WHERE order_id = ?',
            args: [counters[tenantId], row.order_id]
          });
        }

        // Run updates in batches of 100
        for (let i = 0; i < batchUpdates.length; i += 100) {
          const chunk = batchUpdates.slice(i, i + 100);
          await db.batch(chunk, "write");
        }
        console.log('✅ Backfilled order_number sequentially for all existing orders!');
      }
    } catch (err) {
      console.error('❌ Failed backfilling order_number:', err.message);
    }

    // Add delivered_at column and backfill logic
    try {
      await db.execute('ALTER TABLE orders ADD COLUMN delivered_at TEXT');
      console.log('✅ Added delivered_at column to orders table');
    } catch (e) { }

    try {
      await db.execute(`
        UPDATE orders 
        SET delivered_at = COALESCE(delivered_at, delivery_date || ' 12:00:00')
        WHERE status = 'Delivered' AND delivered_at IS NULL
      `);
      console.log('✅ Backfilled delivered_at for legacy delivered orders');
    } catch (e) { }
    
    // TOP Measurements
    const topFields = ['t_length', 't_shoulder', 't_chest', 't_waist', 't_back_neck', 't_front_neck', 't_sleeves_length', 't_sleeves_round', 't_half_body', 't_hip'];
    for (const f of topFields) {
      try { await db.execute(`ALTER TABLE measurements ADD COLUMN ${f} REAL`); console.log(`✅ Added ${f} to measurements`); } catch (e) { }
    }

    // BOTTOM Measurements
    const bottomFields = ['b_length', 'b_bottom_round', 'b_hip', 'b_fly', 'b_thai', 'b_knee'];
    for (const f of bottomFields) {
      try { await db.execute(`ALTER TABLE measurements ADD COLUMN ${f} REAL`); console.log(`✅ Added ${f} to measurements`); } catch (e) { }
    }

    // Add extra_measurements column to measurements table
    try {
      await db.execute('ALTER TABLE measurements ADD COLUMN extra_measurements TEXT');
      console.log('✅ Added extra_measurements column to measurements table');
    } catch (e) { }

    // Embroidery Support Columns
    try {
      await db.execute('ALTER TABLE orders ADD COLUMN has_embroidery INTEGER DEFAULT 0');
      console.log('✅ Added has_embroidery to orders');
    } catch (e) { }
    try {
      await db.execute('ALTER TABLE orders ADD COLUMN embroidery_worker TEXT');
      console.log('✅ Added embroidery_worker to orders');
    } catch (e) { }
    try {
      await db.execute('ALTER TABLE orders ADD COLUMN embroidery_cost REAL DEFAULT 0');
      console.log('✅ Added embroidery_cost to orders');
    } catch (e) { }
    try {
      await db.execute('ALTER TABLE workers ADD COLUMN role TEXT DEFAULT "Stitching"');
      console.log('✅ Added role to workers');
    } catch (e) { }
    try {
      await db.execute('ALTER TABLE orders ADD COLUMN workflow_status TEXT');
      console.log('✅ Added workflow_status to orders');
    } catch (e) { }

    // Ensure measurements has a unique constraint on customer_id (required for ON CONFLICT upsert)
    try {
      await db.execute(`
        DELETE FROM measurements
        WHERE id NOT IN (
          SELECT MAX(id) FROM measurements GROUP BY customer_id
        )
      `);
      console.log('✅ Cleaned duplicate measurement rows');
    } catch (e) { console.log('ℹ️ Measurement dedup skipped:', e.message); }

    try {
      await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_measurements_customer_id ON measurements(customer_id)');
      console.log('✅ Unique index on measurements(customer_id) ensured');
    } catch (e) { console.log('ℹ️ Measurement unique index skipped:', e.message); }

    // Ensure branches table exists
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS branches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tenant_id TEXT NOT NULL,
          name TEXT NOT NULL,
          address TEXT,
          phone_number TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
        )
      `);
      console.log('✅ Ensure branches table exists');
    } catch (e) {
      console.error('❌ Failed to create branches table:', e.message);
    }

    // Alter tables to add branch_id if they don't have it
    const tablesToBranch = ['orders', 'customers', 'expenses', 'alterations', 'workers'];
    for (const tbl of tablesToBranch) {
      try {
        await db.execute(`ALTER TABLE ${tbl} ADD COLUMN branch_id INTEGER`);
        console.log(`✅ Added branch_id column to ${tbl} table`);
      } catch (e) {
        // Ignored if column already exists
      }
    }

    // Create branch indexes
    for (const tbl of tablesToBranch) {
      try {
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_${tbl}_branch ON ${tbl}(branch_id)`);
      } catch (e) {}
    }

    // Auto-create Main Branch and backfill data
    try {
      const tenantsRs = await db.execute('SELECT tenant_id, shop_name FROM tenants');
      for (const t of tenantsRs.rows) {
        const branchRs = await db.execute({
          sql: 'SELECT id FROM branches WHERE tenant_id = ? LIMIT 1',
          args: [t.tenant_id]
        });
        let mainBranchId;
        if (branchRs.rows.length === 0) {
          console.log(`⏳ Creating default Main Branch for tenant: ${t.tenant_id}`);
          const insRs = await db.execute({
            sql: 'INSERT INTO branches (tenant_id, name, address, phone_number) VALUES (?, ?, ?, ?)',
            args: [t.tenant_id, 'Main Branch', '', '']
          });
          mainBranchId = Number(insRs.lastInsertRowid);
        } else {
          mainBranchId = branchRs.rows[0].id;
        }

        // Backfill NULL branch_ids for this tenant
        if (mainBranchId) {
          for (const tbl of tablesToBranch) {
            await db.execute({
              sql: `UPDATE ${tbl} SET branch_id = ? WHERE tenant_id = ? AND branch_id IS NULL`,
              args: [mainBranchId, t.tenant_id]
            });
          }
        }
      }
      console.log('✅ Branches and branch data backfilled successfully!');
    } catch (err) {
      console.error('❌ Error in branches backfill:', err.message);
    }

    console.log('✅ Database Initialized (' + (isLocal ? 'Local' : 'Cloud') + ')');

    // Run storage cleanup for delivered bills older than 30 days
    setTimeout(() => {
      runStorageCleanup();
    }, 5000); // Run 5 seconds after startup

    // Set periodic execution (every 24 hours)
    setInterval(() => {
      runStorageCleanup();
    }, 24 * 60 * 60 * 1000);

  } catch (err) {
    console.error('❌ Database Initialization Error Details:', err);
    throw err;
  }
}

async function runStorageCleanup() {
  try {
    console.log('🧹 Running storage cleanup for Delivered bills older than 60 days...');
    
    // Find all orders that have been delivered for more than 60 days
    const rs = await db.execute(`
      SELECT order_id FROM orders 
      WHERE status = 'Delivered' 
      AND delivered_at IS NOT NULL 
      AND delivered_at <= datetime('now', '-60 days', 'localtime')
    `);
    
    if (rs.rows.length === 0) {
      console.log('✅ No old delivered bills found for storage cleanup.');
      return;
    }
    
    const orderIds = rs.rows.map(row => Number(row.order_id));
    console.log(`🔍 Found ${orderIds.length} order(s) delivered > 60 days ago. Cleaning up images and voice notes...`);
    
    // Delete images and voice notes for these orders
    for (const orderId of orderIds) {
      await db.batch([
        {
          sql: 'DELETE FROM order_images WHERE order_id = ?',
          args: [orderId]
        },
        {
          sql: 'DELETE FROM order_voice_notes WHERE order_id = ?',
          args: [orderId]
        }
      ], "write");
    }
    
    console.log(`✅ Successfully cleaned up storage for ${orderIds.length} old delivered order(s).`);
  } catch (err) {
    console.error('❌ Error during storage cleanup:', err);
  }
}

async function checkPremiumStatus(tenantId) {
  if (!tenantId) return false;
  try {
    const rs = await db.execute({
      sql: 'SELECT subscription_type, created_at FROM tenants WHERE tenant_id = ? LIMIT 1',
      args: [tenantId]
    });
    if (rs.rows.length === 0) return false;
    const tenant = rs.rows[0];

    // If subscription is Monthly or Yearly, premium is active
    if (['Monthly', 'Yearly'].includes(tenant.subscription_type)) {
      return true;
    }

    // Trial: If new user (within 30 days of registration), they get premium access
    const createdAt = new Date(tenant.created_at || Date.now());
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    if (new Date() - createdAt <= thirtyDaysInMs) {
      return true;
    }

    return false;
  } catch (err) {
    console.error('❌ checkPremiumStatus Error:', err.message);
    return false;
  }
}

async function getActiveBranchId(tenantId, headerBranchId) {
  // If a valid specific branch ID is provided, use it directly
  if (headerBranchId && headerBranchId !== 'all' && headerBranchId !== 'undefined' && headerBranchId !== 'null') {
    return Number(headerBranchId);
  }
  // 'all' or missing branch header — fall back to the tenant's first (main) branch.
  // NOTE: This should not normally happen for order creation — the frontend should always
  // send a specific branch ID. 'all' is only valid for analytics/dashboard aggregation.
  if (headerBranchId === 'all') {
    console.warn(`⚠️  getActiveBranchId: 'all' received for tenant "${tenantId}" — falling back to main branch. Check that frontend sends a specific branch ID for order creation.`);
  }
  try {
    const rs = await db.execute({
      sql: 'SELECT id FROM branches WHERE tenant_id = ? ORDER BY id ASC LIMIT 1',
      args: [tenantId]
    });
    return rs.rows[0]?.id || null;
  } catch (err) {
    return null;
  }
}

module.exports = { db, initDB, isLocal, checkPremiumStatus, getActiveBranchId };

