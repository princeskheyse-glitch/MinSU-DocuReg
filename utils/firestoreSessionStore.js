/*
  Lightweight Firestore-backed session store for express-session.
  Stores sessions in the 'sessions' collection so they persist
  across Vercel serverless invocations.
*/
import { Store } from 'express-session';

export class FirestoreStore extends Store {
  constructor(db, options = {}) {
    super();
    this.db = db;
    this.collection = options.collection || 'sessions';
    this.ttl = options.ttl || 86400; // 24 hours in seconds
  }

  col() {
    return this.db.collection(this.collection);
  }

  async get(sid, callback) {
    try {
      console.log('[FirestoreStore] get() sid:', sid);
      const doc = await this.col().doc(sid).get();
      if (!doc.exists) {
        console.log('[FirestoreStore] get() — session NOT found for sid:', sid);
        return callback(null, null);
      }
      const data = doc.data();
      if (data.expires && data.expires.toDate && data.expires.toDate() < new Date()) {
        console.log('[FirestoreStore] get() — session EXPIRED for sid:', sid);
        await this.col().doc(sid).delete();
        return callback(null, null);
      }
      console.log('[FirestoreStore] get() — session FOUND for sid:', sid, '| userId:', data.session?.userId);
      return callback(null, data.session);
    } catch (err) {
      console.error('[FirestoreStore] get() ERROR:', err.message);
      return callback(err);
    }
  }

  async set(sid, session, callback) {
    try {
      console.log('[FirestoreStore] set() sid:', sid, '| userId:', session?.userId);
      const expires = new Date(Date.now() + this.ttl * 1000);
      const sessionData = JSON.parse(JSON.stringify(session));
      await this.col().doc(sid).set({
        session: sessionData,
        expires,
        updatedAt: new Date()
      });
      console.log('[FirestoreStore] set() SUCCESS for sid:', sid);
      return callback(null);
    } catch (err) {
      console.error('[FirestoreStore] set() ERROR:', err.message);
      return callback(err);
    }
  }

  async destroy(sid, callback) {
    try {
      await this.col().doc(sid).delete();
      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }

  async touch(sid, session, callback) {
    try {
      const expires = new Date(Date.now() + this.ttl * 1000);
      await this.col().doc(sid).update({ expires, updatedAt: new Date() });
      return callback(null);
    } catch (err) {
      // If doc doesn't exist, set it
      return this.set(sid, session, callback);
    }
  }
}
