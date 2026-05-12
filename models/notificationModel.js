/*
    MinSU DocuReg - Notification Model (Firestore)
*/
import { db, Collections, docToObj, snapshotToArray, newId } from './db.js';

const col = () => db.collection(Collections.NOTIFICATIONS);

export const Notification = {
  async create(data) {
    const id = newId();
    const notif = {
      userId: data.userId, type: data.type, title: data.title,
      message: data.message, link: data.link || null,
      isRead: false, createdAt: new Date(), updatedAt: new Date()
    };
    await col().doc(id).set(notif);
    return { id, ...notif };
  },

  async findAll(conditions = {}, opts = {}) {
    try {
      let q = col().where('userId', '==', conditions.userId).orderBy('createdAt', 'desc');
      if (opts.limit) q = q.limit(opts.limit);
      const snap = await q.get();
      return snapshotToArray(snap);
    } catch (err) {
      // Fallback if composite index doesn't exist yet — fetch without orderBy and sort in JS
      if (err.code === 9 || (err.message && err.message.includes('index'))) {
        let q = col().where('userId', '==', conditions.userId);
        const snap = await q.get();
        let docs = snapshotToArray(snap).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        if (opts.limit) docs = docs.slice(0, opts.limit);
        return docs;
      }
      throw err;
    }
  },

  async update(id, data) {
    data.updatedAt = new Date();
    await col().doc(id).update(data);
  },

  async updateWhere(conditions, data) {
    // Only supports userId + isRead filter
    let q = col().where('userId', '==', conditions.userId);
    if (conditions.isRead !== undefined) q = q.where('isRead', '==', conditions.isRead);
    const snap = await q.get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.update(doc.ref, { ...data, updatedAt: new Date() }));
    if (!snap.empty) await batch.commit();
  }
};
