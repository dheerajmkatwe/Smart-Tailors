const { db } = require('./db');

async function removeDefault() {
  try {
    await db.execute("DELETE FROM branches WHERE tenant_id = 'default'");
    await db.execute("DELETE FROM tenants WHERE tenant_id = 'default'");
    console.log('✅ Default tenant removed.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

removeDefault();
