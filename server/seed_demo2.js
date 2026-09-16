const { db } = require('./db');

async function seedDemo2() {
  try {
    const tenant_id = 'free-trial-demo2';
    const shop_name = 'Expired Trial Shop';
    const phone_number = '8888888888';
    const admin_name = 'Demo 2 Admin';
    const password = 'demo2';
    // Registered over 40 days ago (expired trial)
    const created_at = '2026-04-20 12:00:00'; 

    await db.execute({
      sql: 'DELETE FROM tenants WHERE tenant_id = ?',
      args: [tenant_id]
    });

    await db.execute({
      sql: 'DELETE FROM branches WHERE tenant_id = ?',
      args: [tenant_id]
    });

    await db.execute({
      sql: 'INSERT INTO tenants (tenant_id, shop_name, address, phone_number, admin_name, password, subscription_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [tenant_id, shop_name, '456 Fashion Boulevard', phone_number, admin_name, password, 'Free', created_at]
    });

    // Directly insert the default branch for free-trial-demo2 to ensure immediate availability
    await db.execute({
      sql: 'INSERT INTO branches (tenant_id, name, address, phone_number) VALUES (?, ?, ?, ?)',
      args: [tenant_id, 'Main Branch', '456 Fashion Boulevard', phone_number]
    });

    console.log('✅ Expired Free Trial Demo 2 tenant successfully seeded!');
    console.log('----------------------------------------------------');
    console.log('Shop Username / Phone:', tenant_id);
    console.log('Password:', password);
    console.log('Subscription Status:', 'Free (Trial Expired)');
    console.log('----------------------------------------------------');
  } catch (err) {
    console.error('Error seeding free-trial-demo2:', err.message);
  }
}

seedDemo2();
