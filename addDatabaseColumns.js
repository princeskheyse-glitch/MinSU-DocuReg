import { sequelize } from "./models/db.js";

const addMissingColumns = async () => {
  try {
    console.log("Adding missing columns to DocumentRequests table...");
    
    // Add expectedCompletionDate column
    await sequelize.query(`
      ALTER TABLE DocumentRequests 
      ADD COLUMN IF NOT EXISTS expectedCompletionDate DATETIME NULL 
      COMMENT '6 working days from request creation'
    `);
    console.log("✅ Added expectedCompletionDate column");
    
    // Add appointmentRequired column
    await sequelize.query(`
      ALTER TABLE DocumentRequests 
      ADD COLUMN IF NOT EXISTS appointmentRequired BOOLEAN DEFAULT true 
      COMMENT 'Appointment scheduling is required for document pickup'
    `);
    console.log("✅ Added appointmentRequired column");
    
    // Add appointmentScheduled column
    await sequelize.query(`
      ALTER TABLE DocumentRequests 
      ADD COLUMN IF NOT EXISTS appointmentScheduled BOOLEAN DEFAULT false
    `);
    console.log("✅ Added appointmentScheduled column");
    
    // Update existing records with default expectedCompletionDate (6 days from creation)
    await sequelize.query(`
      UPDATE DocumentRequests 
      SET expectedCompletionDate = DATE_ADD(createdAt, INTERVAL 6 DAY)
      WHERE expectedCompletionDate IS NULL
    `);
    console.log("✅ Updated existing records with expectedCompletionDate");
    
    // Create index for performance
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_expectedCompletionDate 
      ON DocumentRequests(expectedCompletionDate)
    `);
    console.log("✅ Created index on expectedCompletionDate");
    
    console.log("\n✅ All database columns added successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
};

addMissingColumns();
