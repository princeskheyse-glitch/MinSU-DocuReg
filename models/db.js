/*
    MinSU DocuReg - Firebase Firestore Database Connection
*/
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load service account — file takes priority (local dev), env var used on Vercel/production
let serviceAccount = null;
const serviceAccountPath = join(__dirname, '../firebase-service-account.json');

if (existsSync(serviceAccountPath)) {
  try {
    const require = createRequire(import.meta.url);
    serviceAccount = require('../firebase-service-account.json');
    console.log('✅ Firebase: loaded from service account file');
  } catch (e) {
    console.error('❌ Firebase: failed to parse service account file:', e.message);
  }
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('✅ Firebase: loaded from FIREBASE_SERVICE_ACCOUNT env var');
  } catch (e) {
    console.error('❌ Firebase: failed to parse FIREBASE_SERVICE_ACCOUNT env var:', e.message);
  }
} else {
  console.error('❌ Firebase: no service account found. Set FIREBASE_SERVICE_ACCOUNT env var on Vercel.');
}

// Initialize only once — skip if no credentials (app will show config error)
if (serviceAccount && !getApps().length) {
  try {
    initializeApp({ credential: cert(serviceAccount) });
    console.log('✅ Firebase Admin initialized');
  } catch (e) {
    console.error('❌ Firebase Admin init failed:', e.message);
    serviceAccount = null;
  }
}

export const db = serviceAccount ? getFirestore() : null;

// Collection references
export const Collections = {
  USERS:         'users',
  CAMPUSES:      'campuses',
  REQUESTS:      'documentRequests',
  APPOINTMENTS:  'appointments',
  NOTIFICATIONS: 'notifications'
};

export const docToObj = (doc) => {
  if (!doc.exists) return null;
  const data = doc.data();
  Object.keys(data).forEach(key => {
    if (data[key]?.toDate) data[key] = data[key].toDate();
  });
  return { id: doc.id, ...data };
};

export const snapshotToArray = (snapshot) =>
  snapshot.docs.map(docToObj);

export const newId = () => db ? db.collection('_').doc().id : Math.random().toString(36).slice(2);
