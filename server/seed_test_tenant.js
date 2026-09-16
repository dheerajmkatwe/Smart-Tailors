const { db } = require('./db');

async function seed() {
  try {
    const tenant_id = 'free-trial-demo';
    const shop_name = 'Free Trial Demo Shop';
    const phone_number = '9999999999';
    const admin_name = 'Demo Admin';
    const password = 'demo';
    const created_at = '2026-04-01 12:00:00'; // Registered 2 months ago (expired trial)

    await db.execute({
      sql: 'DELETE FROM tenants WHERE tenant_id = ?',
      args: [tenant_id]
    });

    await db.execute({
      sql: 'INSERT INTO tenants (tenant_id, shop_name, address, phone_number, admin_name, password, subscription_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [tenant_id, shop_name, '123 Fashion Street', phone_number, admin_name, password, 'Free', created_at]
    });

    console.log('✅ Expired Free Trial tenant successfully seeded!');
    console.log('Credentials:');
    console.log('Shop Username / Phone:', tenant_id);
    console.log('Password:', password);
  } catch (err) {
    console.error('Error seeding test tenant:', err.message);
  }
}

seed();
