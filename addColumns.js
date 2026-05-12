import { sequelize } from "./models/db.js";

async function addMissingColumns() {
  try {
    await sequelize.authenticate();
    console.log("✅ Connected to MySQL database!");

    // Add the three missing columns to DocumentRequests table
    const queries = [
      `ALTER TABLE DocumentRequests ADD COLUMN expectedCompletionDate DATE DEFAULT NULL AFTER documentType;`,
      `ALTER TABLE DocumentRequests ADD COLUMN appointmentRequired TINYINT(1) DEFAULT 1 AFTER expectedCompletionDate;`,
      `ALTER TABLE DocumentRequests ADD COLUMN appointmentScheduled TINYINT(1) DEFAULT 0 AFTER appointmentRequired;`
    ];

    for (const query of queries) {
      try {
        await sequelize.query(query);
        console.log(`✅ Column added successfully`);
      } catch (err) {
        // Column might already exist, which is fine
        if (err.message.includes("Duplicate column")) {
          console.log(`⚠️  Column already exists (skipping)`);
        } else {
          throw err;
        }
      }
    }

    console.log("✅ All columns processed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to add columns:", err.message);
    process.exit(1);
  }
}

addMissingColumns();
