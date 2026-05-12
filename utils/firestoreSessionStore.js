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
      const doc = await this.col().doc(sid).get();
      if (!doc.exists) return callback(null, null);
      const data = doc.data();
      // Check expiry
      if (data.expires && data.expires.toDate && data.expires.toDate() < new Date()) {
        await this.col().doc(sid).delete();
        return callback(null, null);
      }
      return callback(null, data.session);
    } catch (err) {
      return callback(err);
    }
  }

  async set(sid, session, callback) {
    try {
      const expires = new Date(Date.now() + this.ttl * 1000);
      await this.col().doc(sid).set({
        session,
        expires,
        updatedAt: new Date()
      });
      return callback(null);
    } catch (err) {
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
