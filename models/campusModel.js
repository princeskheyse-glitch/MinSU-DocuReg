/*
    MinSU DocuReg - Campus Model (Firestore)
    No orderBy in Firestore queries — sort in JS to avoid composite index errors.
*/
import { db, Collections, docToObj, snapshotToArray, newId } from './db.js';

const col = () => db.collection(Collections.CAMPUSES);

export const Campus = {
  async create(data) {
    const id = newId();
    const campus = {
      name: data.name, code: data.code,
      address: data.address || null, contactEmail: data.contactEmail || null,
      contactPhone: data.contactPhone || null, isActive: data.isActive !== false,
      createdAt: new Date()
    };
    await col().doc(id).set(campus);
    return { id, ...campus };
  },

  async findById(id) {
    if (!id) return null;
    const doc = await col().doc(id).get();
    return docToObj(doc);
  },

  async findAll(conditions = {}) {
    let q = col();
    // Apply single equality filter if provided
    const keys = Object.keys(conditions);
    if (keys.length > 0) {
      const [k, v] = Object.entries(conditions)[0];
      q = q.where(k, '==', v);
    }
    const snap = await q.get();
    const docs = snapshotToArray(snap);
    // Sort by name in JS
    return docs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  },

  async update(id, data) {
    await col().doc(id).update(data);
    return this.findById(id);
  }
};
