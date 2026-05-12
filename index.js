/*
    MIT License
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines
*/

import dotenv from 'dotenv';
dotenv.config();

import express from "express";
import path from "path";
import session from "express-session";
import flash from "connect-flash";
import router from "./routes/index.js";
import fs from 'fs';
import hbs from "hbs";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Initialize Firebase
import { db } from "./models/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: process.env.SESSION_SECRET || "xianfire-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
app.use(flash());

// ── Handlebars Helpers ──
hbs.registerHelper('if_eq', function(a, b, options) {
  return (a === b) ? options.fn(this) : options.inverse(this);
});

hbs.registerHelper('unless_eq', function(a, b, options) {
  return (a !== b) ? options.fn(this) : options.inverse(this);
});

hbs.registerHelper('formatDate', (date) => {
  if (!date) return '';
  const d = date._seconds ? new Date(date._seconds * 1000) : new Date(date);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
});

hbs.registerHelper('truncate', (str, length) => {
  if (!str) return '';
  return str.length <= length ? str : str.substring(0, length) + '...';
});

hbs.registerHelper('switch', function(value, options) {
  this._switch_value_ = value;
  const html = options.fn(this);
  delete this._switch_value_;
  return html;
});

hbs.registerHelper('case', function(value, options) {
  return value === this._switch_value_ ? options.fn(this) : '';
});

hbs.registerHelper('multiply', (a, b) => a * b);

hbs.registerHelper('formatTime', (time) => {
  if (!time) return '';
  const parts = String(time).match(/^(\d{1,2}):(\d{2})/);
  if (!parts) return time;
  const h = parseInt(parts[1]);
  const m = parts[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
});

hbs.registerHelper('json', (context) => JSON.stringify(context || []));

hbs.registerHelper('formatDocType', (docType) => {
  if (!docType) return '';
  const map = {
    transcript:             'Transcript of Records',
    transfer_credentials:   'Certificate of Transfer Credentials',
    diploma_copy:           'Second Copy of Diploma',
    certificate:            'Certificate of Graduation',
    verification:           'Verification / Authentication Letter',
    enrollment_certificate: 'Certificate of Enrollment',
    good_moral:             'Good Moral Certificate'
  };
  return map[docType] || docType;
});

// ── View engine ──
app.engine("xian", async (filePath, options, callback) => {
  try {
    const originalPartialsDir = hbs.partialsDir;
    hbs.partialsDir = path.join(__dirname, 'views');
    const result = await new Promise((resolve, reject) => {
      hbs.__express(filePath, options, (err, html) => {
        if (err) return reject(err);
        resolve(html);
      });
    });
    hbs.partialsDir = originalPartialsDir;
    callback(null, result);
  } catch (err) {
    callback(err);
  }
});

app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  next();
});

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "xian");

// ── Register partials ──
const partialsDir = path.join(__dirname, "views/partials");
try {
  fs.readdirSync(partialsDir)
    .filter(f => f.endsWith('.xian') || f.endsWith('.hbs'))
    .forEach(file => {
      const name = file.replace(/\.(xian|hbs)$/, '');
      const content = fs.readFileSync(path.join(partialsDir, file), 'utf8');
      hbs.registerPartial(name, content);
    });
  console.log("✅ Partials registered");
} catch (err) {
  console.error("❌ Could not register partials:", err);
}

app.use("/", router);

// ── Local dev server (not used on Vercel) ──
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, async () => {
    console.log(`🔥 XianFire running at http://localhost:${PORT}`);
    // Verify Firestore only in local dev
    try {
      await db.collection('_health').doc('ping').set({ ts: new Date() });
      await db.collection('_health').doc('ping').delete();
      console.log("✅ Connected to Firebase Firestore!");
    } catch (err) {
      console.error("❌ Firestore connection failed:", err.message);
    }
  });
}

export default app;
