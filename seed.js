/*
    MinSU DocuReg - Firestore Seed
    Seeds: 3 campuses + superadmin + per-campus admin, registrar, student
*/
import dotenv from 'dotenv';
dotenv.config();

import bcrypt from "bcrypt";
import { db } from "./models/db.js";
import { Campus } from "./models/campusModel.js";
import { User } from "./models/userModel.js";

const campusData = [
  { name: "Victoria Main Campus", code: "VICTORIA", address: "Victoria, Oriental Mindoro", contactEmail: "victoria@minsu.edu.ph", contactPhone: "+63-43-123-4567" },
  { name: "Calapan Campus",       code: "CALAPAN",  address: "Calapan City, Oriental Mindoro", contactEmail: "calapan@minsu.edu.ph",  contactPhone: "+63-43-234-5678" },
  { name: "Bongabong Campus",     code: "BONGABONG",address: "Bongabong, Oriental Mindoro",    contactEmail: "bongabong@minsu.edu.ph", contactPhone: "+63-43-345-6789" }
];

async function seedDatabase() {
  try {
    console.log("🔥 Connecting to Firestore...");

    const force = process.argv.includes('--force');

    // Check existing users
    const existingSnap = await db.collection('users').limit(1).get();
    if (!existingSnap.empty && !force) {
      console.log("⚠️  Database already has users. Skipping seed.");
      console.log("   Run with --force to reseed: npm run seed -- --force");
      process.exit(0);
    }

    if (force && !existingSnap.empty) {
      console.log("⚠️  Force mode: clearing all data...");
      const collections = ['users', 'campuses', 'documentRequests', 'appointments', 'notifications'];
      for (const col of collections) {
        const snap = await db.collection(col).get();
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        if (!snap.empty) await batch.commit();
        console.log(`  🗑️  Cleared ${col} (${snap.size} docs)`);
      }
    }

    // Create campuses
    console.log("\n🏫 Creating campuses...");
    const createdCampuses = {};
    for (const c of campusData) {
      const campus = await Campus.create(c);
      createdCampuses[c.code] = campus;
      console.log(`  ✅ ${c.name} (ID: ${campus.id})`);
    }

    // Super admin
    console.log("\n👑 Creating Super Admin...");
    await User.create({
      name: "Super Admin",
      email: "superadmin@minsu.edu.ph",
      password: await bcrypt.hash("superadmin123", 10),
      role: "superadmin",
      campusId: null,
      status: "active"
    });
    console.log("  ✅ superadmin@minsu.edu.ph");

    // Per-campus accounts
    console.log("\n🏫 Creating campus accounts...");
    for (const [code, campus] of Object.entries(createdCampuses)) {
      const label = code.toLowerCase();
      await User.create({ name: `${campus.name} Admin`,     email: `admin.${label}@minsu.edu.ph`,                  password: await bcrypt.hash("admin123", 10),     role: "admin",     campusId: campus.id, status: "active" });
      await User.create({ name: `${campus.name} Registrar`, email: `registrar.${label}@minsu.edu.ph`,              password: await bcrypt.hash("registrar123", 10), role: "registrar", campusId: campus.id, status: "active" });
      await User.create({ name: `Student ${campus.name}`,   email: `student.${label}@student.minsu.edu.ph`,        password: await bcrypt.hash("student123", 10),   role: "student",   campusId: campus.id, status: "active", studentId: `${code.substring(0,3)}-2024-001` });
      console.log(`  ✅ ${campus.name}: admin, registrar, student`);
    }

    console.log("\n🌱 Firestore seeded successfully!\n");
    console.log("═══════════════════════════════════════════════════");
    console.log("📋 LOGIN CREDENTIALS");
    console.log("═══════════════════════════════════════════════════");
    console.log("\n👑 SUPER ADMIN:");
    console.log("   Email:    superadmin@minsu.edu.ph");
    console.log("   Password: superadmin123\n");
    for (const [code, campus] of Object.entries(createdCampuses)) {
      const label = code.toLowerCase();
      console.log(`🏫 ${campus.name}:`);
      console.log(`   Admin:     admin.${label}@minsu.edu.ph  /  admin123`);
      console.log(`   Registrar: registrar.${label}@minsu.edu.ph  /  registrar123`);
      console.log(`   Student:   student.${label}@student.minsu.edu.ph  /  student123\n`);
    }
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  }
}

seedDatabase();
