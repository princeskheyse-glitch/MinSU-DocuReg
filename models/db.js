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
let serviceAccount;
const serviceAccountPath = join(__dirname, '../firebase-service-account.json');

if (existsSync(serviceAccountPath)) {
  const require = createRequire(import.meta.url);
  serviceAccount = require('../firebase-service-account.json');
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  throw new Error('Firebase service account not found. Provide firebase-service-account.json or FIREBASE_SERVICE_ACCOUNT env var.');
}

// Initialize only once
if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

export const db = getFirestore();

// Collection references
export const Collections = {
  USERS:         'users',
  CAMPUSES:      'campuses',
  REQUESTS:      'documentRequests',
  APPOINTMENTS:  'appointments',
  NOTIFICATIONS: 'notifications'
};

/**
 * Convert a Firestore doc snapshot to a plain object with id
 */
export const docToObj = (doc) => {
  if (!doc.exists) return null;
  const data = doc.data();
  // Convert Firestore Timestamps to JS Dates
  Object.keys(data).forEach(key => {
    if (data[key]?.toDate) data[key] = data[key].toDate();
  });
  return { id: doc.id, ...data };
};

/**
 * Convert a Firestore query snapshot to array of plain objects
 */
export const snapshotToArray = (snapshot) =>
  snapshot.docs.map(docToObj);

/**
 * Generate a short unique ID (Firestore auto-IDs are fine but we expose this helper)
 */
export const newId = () => db.collection('_').doc().id;
