const { db, initDB } = require('./db');

async function resetAllData() {
  try {
    console.log('⏳ Wiping all application data (tenants, customers, orders, measurements, workers, branches, etc.)...');
    
    const tables = [
      'order_voice_notes',
      'order_images',
      'services',
      'orders',
      'measurements',
      'customers',
      'expenses',
      'alterations',
      'workers',
      'branches',
      'otps',
      'blocked_numbers',
      'tenants'
    ];

    for (const table of tables) {
      console.log(`🧹 Clearing table: ${table}`);
      await db.execute(`DELETE FROM ${table}`);
      
      try {
        await db.execute(`DELETE FROM sqlite_sequence WHERE name = '${table}'`);
      } catch (e) {
        // Ignored if sqlite_sequence does not exist for this table
      }
    }

    console.log('✅ All existing tenants and operational data deleted.');
    console.log('⏳ Re-initializing fresh database schema and default tenant...');
    
    await initDB();

    console.log('\n✨ RESET COMPLETE!');
    console.log('   - All boutique accounts, customers, orders, and measurements have been removed.');
    console.log('   - Default shop tenant ("default") has been re-created for demo onboarding.');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error resetting database:', err);
    process.exit(1);
  }
}

resetAllData();
