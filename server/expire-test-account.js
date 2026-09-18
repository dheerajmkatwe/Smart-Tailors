const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./lm_tailor.db');

// Set created_at to 45 days ago so account looks expired
db.run(
  "UPDATE tenants SET created_at = '2026-08-01 10:00:00' WHERE tenant_id = 'dheeraj'",
  function(err) {
    if (err) console.error('Error:', err.message);
    else console.log('✅ Test account expired! Rows changed:', this.changes);
    db.close();
  }
);
