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
import { FirestoreStore } from "./utils/firestoreSessionStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ── Allow credentials from the same origin (needed for fetch with credentials:'include') ──
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(session({
  secret: process.env.SESSION_SECRET || "xianfire-secret-key",
  resave: false,
  saveUninitialized: false,
  store: db ? new FirestoreStore(db, { collection: 'sessions', ttl: 86400 }) : undefined,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
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
  // Prevent Vercel edge caching any authenticated responses
  if (req.path.startsWith('/auth/') || req.session?.userId) {
    res.setHeader('Cache-Control', 'no-store, private');
  }
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

// ── Config check middleware — shows helpful error if Firebase not configured ──
app.use((req, res, next) => {
  if (!db) {
    return res.status(503).send(`
      <!DOCTYPE html><html><head><title>Configuration Required</title>
      <style>body{font-family:sans-serif;max-width:600px;margin:80px auto;padding:20px;background:#f9fafb}
      h1{color:#dc2626}code{background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:14px}
      .box{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:24px;margin-top:16px}</style>
      </head><body>
      <h1>⚙️ Firebase Not Configured</h1>
      <div class="box">
        <p>The app is missing its Firebase credentials. Add this environment variable in your <strong>Vercel project settings</strong>:</p>
        <p><code>FIREBASE_SERVICE_ACCOUNT</code> — paste the full contents of your <code>firebase-service-account.json</code> file as the value.</p>
        <p>Also ensure these are set:</p>
        <ul>
          <li><code>SESSION_SECRET</code> — any long random string</li>
          <li><code>NODE_ENV</code> = <code>production</code></li>
          <li><code>EMAIL_USER</code> — your Gmail address</li>
          <li><code>EMAIL_PASS</code> — your Gmail app password</li>
        </ul>
        <p>After adding variables, click <strong>Redeploy</strong> in Vercel.</p>
      </div>
      </body></html>
    `);
  }
  next();
});

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
