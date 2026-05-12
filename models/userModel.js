/*
    MinSU DocuReg - User Model (Firestore)
    No orderBy in Firestore — sort in JS to avoid composite index errors.
*/
import { db, Collections, docToObj, snapshotToArray, newId } from './db.js';

const col = () => db.collection(Collections.USERS);

const splitConditions = (conditions) => {
  const keys = Object.keys(conditions);
  if (keys.length === 0) return { fsField: null, fsValue: null, jsFilters: {} };
  const priority = ['campusId', 'role', 'status', 'studentId'];
  const fsKey = priority.find(k => keys.includes(k)) || keys[0];
  const { [fsKey]: fsValue, ...jsFilters } = conditions;
  return { fsField: fsKey, fsValue, jsFilters };
};

const applyJsFilters = (docs, jsFilters) =>
  docs.filter(doc => Object.entries(jsFilters).every(([k, v]) =>
    Array.isArray(v) ? v.includes(doc[k]) : doc[k] === v));

const sortDocs = (docs, orderBy, orderDir) => {
  if (!orderBy) return docs;
  return [...docs].sort((a, b) => {
    const av = a[orderBy], bv = b[orderBy];
    const dir = orderDir === 'desc' ? -1 : 1;
    if (av == null) return dir;
    if (bv == null) return -dir;
    return av < bv ? -dir : av > bv ? dir : 0;
  });
};

export const User = {
  async create(data) {
    const id = newId();
    const now = new Date();
    const user = {
      name: data.name, email: data.email, password: data.password,
      studentId: data.studentId || null, role: data.role || 'student',
      campusId: data.campusId || null, status: data.status || 'active',
      createdAt: now, updatedAt: now
    };
    await col().doc(id).set(user);
    return { id, ...user };
  },

  async findById(id) {
    if (!id) return null;
    const doc = await col().doc(id).get();
    return docToObj(doc);
  },

  async findOne(conditions) {
    const { fsField, fsValue, jsFilters } = splitConditions(conditions);
    let q = col();
    if (fsField) q = q.where(fsField, '==', fsValue);
    const snap = await q.get();
    const docs = applyJsFilters(snapshotToArray(snap), jsFilters);
    return docs[0] || null;
  },

  async findAll(conditions = {}, opts = {}) {
    const { fsField, fsValue, jsFilters } = splitConditions(conditions);
    let q = col();
    if (fsField) q = q.where(fsField, '==', fsValue);
    const snap = await q.get();
    let docs = applyJsFilters(snapshotToArray(snap), jsFilters);
    docs = sortDocs(docs, opts.orderBy || 'createdAt', opts.orderDir || 'desc');
    if (opts.limit) docs = docs.slice(0, opts.limit);
    return docs;
  },

  async count(conditions = {}) {
    const docs = await this.findAll(conditions);
    return docs.length;
  },

  async update(id, data) {
    data.updatedAt = new Date();
    await col().doc(id).update(data);
    return this.findById(id);
  },

  async delete(id) {
    await col().doc(id).delete();
  }
};
