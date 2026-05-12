import { sequelize } from "./models/db.js";

const addMissingColumns = async () => {
  try {
    // Add missing columns to DocumentRequests table
    await sequelize.query(`
      ALTER TABLE DocumentRequests 
      ADD COLUMN IF NOT EXISTS expectedCompletionDate DATETIME NULL AFTER updatedAt,
      ADD COLUMN IF NOT EXISTS appointmentRequired BOOLEAN DEFAULT true AFTER expectedCompletionDate,
      ADD COLUMN IF NOT EXISTS appointmentScheduled BOOLEAN DEFAULT false AFTER appointmentRequired
    `);
    
    console.log("✅ Columns added successfully!");
    
    // Update existing records
    await sequelize.query(`
      UPDATE DocumentRequests 
      SET expectedCompletionDate = DATE_ADD(createdAt, INTERVAL 6 DAY)
      WHERE expectedCompletionDate IS NULL
    `);
    
    console.log("✅ Existing records updated!");
    
    // Create index
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_expectedCompletionDate ON DocumentRequests(expectedCompletionDate)
    `);
    
    console.log("✅ Index created!");
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

addMissingColumns();
