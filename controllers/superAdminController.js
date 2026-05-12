/*
    MinSU DocuReg - Super Admin Controller (Firestore)
*/
import { User } from "../models/userModel.js";
import { DocumentRequest } from "../models/documentModel.js";
import { Appointment } from "../models/appointmentModel.js";
import { Campus } from "../models/campusModel.js";
import bcrypt from "bcrypt";

export const getDashboard = async (req, res) => {
  try {
    const campuses = await Campus.findAll({ isActive: true });
    const [totalUsers, totalStudents, totalRegistrars, totalAdmins, activeUsers, suspendedUsers,
           totalRequests, pendingRequests, processingRequests, completedRequests,
           totalAppointments, scheduledAppointments] = await Promise.all([
      User.count({}), User.count({ role:'student' }), User.count({ role:'registrar' }), User.count({ role:'admin' }),
      User.count({ status:'active' }), User.count({ status:'suspended' }),
      DocumentRequest.count({}), DocumentRequest.count({ status:'pending' }), DocumentRequest.count({ status:'processing' }), DocumentRequest.count({ status:'completed' }),
      Appointment.count({}), Appointment.count({ status:'scheduled' })
    ]);
    const stats = { totalUsers, totalStudents, totalRegistrars, totalAdmins, activeUsers, suspendedUsers, totalRequests, pendingRequests, processingRequests, completedRequests, totalAppointments, scheduledAppointments };
    const campusStats = await Promise.all(campuses.map(async campus => ({
      campus,
      users:     await User.count({ campusId: campus.id }),
      students:  await User.count({ campusId: campus.id, role: 'student' }),
      requests:  await DocumentRequest.count({ campusId: campus.id }),
      pending:   await DocumentRequest.count({ campusId: campus.id, status: 'pending' }),
      completed: await DocumentRequest.count({ campusId: campus.id, status: 'completed' })
    })));
    const rawRecent = await DocumentRequest.findAll({}, { orderBy: 'createdAt', orderDir: 'desc', limit: 8 });
    const recentRequests = await Promise.all(rawRecent.map(async r => ({
      ...r,
      student: await User.findById(r.studentId) || null,
      campus: r.campusId ? await Campus.findById(r.campusId) : null
    })));
    const rawUsers = await User.findAll({}, { orderBy: 'createdAt', orderDir: 'desc', limit: 8 });
    const recentUsers = await Promise.all(rawUsers.map(async u => ({ ...u, campus: u.campusId ? await Campus.findById(u.campusId) : null })));
    res.render("superadmin/dashboard", { title: "Super Admin Dashboard", stats, campusStats, campuses, recentRequests, recentUsers, user: req.user });
  } catch (err) {
    console.error("Super admin dashboard error:", err);
    res.render("error", { title: "Error", message: "Error loading dashboard", statusCode: 500 });
  }
};

export const getCampuses = async (req, res) => {
  try {
    const all = await Campus.findAll({});
    const campuses = await Promise.all(all.map(async campus => ({
      ...campus,
      users: [...await User.findAll({ campusId: campus.id, role: 'admin' }), ...await User.findAll({ campusId: campus.id, role: 'registrar' })]
    })));
    res.render("superadmin/campuses", { title: "Campus Management", campuses, user: req.user });
  } catch (err) {
    console.error("Error fetching campuses:", err);
    res.render("error", { title: "Error", message: "Error fetching campuses", statusCode: 500 });
  }
};

export const getRequests = async (req, res) => {
  try {
    const { campus, status } = req.query;
    const campuses = await Campus.findAll({ isActive: true });
    const conditions = {};
    if (campus) conditions.campusId = campus;
    if (status) conditions.status   = status;
    const raw = await DocumentRequest.findAll(conditions, { orderBy: 'createdAt', orderDir: 'desc' });
    const requests = await Promise.all(raw.map(async r => ({
      ...r,
      student: await User.findById(r.studentId) || null,
      campus: r.campusId ? await Campus.findById(r.campusId) : null
    })));
    res.render("superadmin/requests", { title: "All Document Requests", requests, campuses, filters: { campus, status }, user: req.user });
  } catch (err) {
    console.error("Error fetching requests:", err);
    res.render("error", { title: "Error", message: "Error fetching requests", statusCode: 500 });
  }
};

export const getRequestDetails = async (req, res) => {
  try {
    const request = await DocumentRequest.findById(req.params.id);
    if (!request) return res.render("error", { title: "Not Found", message: "Request not found", statusCode: 404 });
    const [student, registrar, campus, appointments] = await Promise.all([
      User.findById(request.studentId),
      request.processedBy ? User.findById(request.processedBy) : Promise.resolve(null),
      request.campusId ? Campus.findById(request.campusId) : Promise.resolve(null),
      Appointment.findAll({ documentRequestId: request.id })
    ]);
    res.render("superadmin/request-details", { title: "Request Details", request: { ...request, student: student||null, registrar: registrar||null, campus: campus||null }, appointments, user: req.user });
  } catch (err) {
    console.error("Error fetching request details:", err);
    res.render("error", { title: "Error", message: "Error fetching request", statusCode: 500 });
  }
};

export const getUsers = async (req, res) => {
  try {
    const { role, status, campus, search } = req.query;
    const conditions = {};
    if (role)   conditions.role     = role;
    if (status) conditions.status   = status;
    if (campus) conditions.campusId = campus;
    let users = await User.findAll(conditions, { orderBy: 'createdAt', orderDir: 'desc' });
    if (search) { const q = search.toLowerCase(); users = users.filter(u => (u.name&&u.name.toLowerCase().includes(q))||(u.email&&u.email.toLowerCase().includes(q))||(u.studentId&&u.studentId.toLowerCase().includes(q))); }
    const enriched = await Promise.all(users.map(async u => ({ ...u, campus: u.campusId ? await Campus.findById(u.campusId) : null })));
    const campuses = await Campus.findAll({ isActive: true });
    res.render("superadmin/users", { title: "All Users — Global", users: enriched, campuses, filters: { role, status, campus, search }, user: req.user });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.render("error", { title: "Error", message: "Error fetching users", statusCode: 500 });
  }
};

export const getUserDetails = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.render("error", { title: "Not Found", message: "User not found", statusCode: 404 });
    const [campusObj, campuses, rawRequests] = await Promise.all([
      targetUser.campusId ? Campus.findById(targetUser.campusId) : Promise.resolve(null),
      Campus.findAll({ isActive: true }),
      DocumentRequest.findAll({ studentId: targetUser.id }, { orderBy: 'createdAt', orderDir: 'desc' })
    ]);
    const userRequests = await Promise.all(rawRequests.map(async r => ({ ...r, campus: r.campusId ? await Campus.findById(r.campusId) : null })));
    res.render("superadmin/user-details", { title: `User: ${targetUser.name}`, targetUser: { ...targetUser, campus: campusObj||null }, campuses, userRequests, user: req.user });
  } catch (err) {
    console.error("Error fetching user details:", err);
    res.render("error", { title: "Error", message: "Error fetching user", statusCode: 500 });
  }
};

export const updateUserRole = async (req, res) => {
  const { role } = req.body;
  try {
    const t = await User.findById(req.params.id);
    if (!t) return res.render("error", { title: "Not Found", message: "User not found", statusCode: 404 });
    if (t.id === req.user.id) return res.render("error", { title: "Cannot Update", message: "Cannot change your own role", statusCode: 400 });
    await User.update(t.id, { role });
    res.redirect(`/superadmin/users/${t.id}`);
  } catch (err) { res.render("error", { title: "Error", message: "Error updating user", statusCode: 500 }); }
};

export const updateUserStatus = async (req, res) => {
  const { status } = req.body;
  try {
    const t = await User.findById(req.params.id);
    if (!t) return res.render("error", { title: "Not Found", message: "User not found", statusCode: 404 });
    if (t.id === req.user.id && status !== 'active') return res.render("error", { title: "Cannot Update", message: "Cannot suspend your own account", statusCode: 400 });
    await User.update(t.id, { status });
    res.redirect(`/superadmin/users/${t.id}`);
  } catch (err) { res.render("error", { title: "Error", message: "Error updating user", statusCode: 500 }); }
};

export const assignUserCampus = async (req, res) => {
  const { campusId } = req.body;
  try {
    const t = await User.findById(req.params.id);
    if (!t) return res.render("error", { title: "Not Found", message: "User not found", statusCode: 404 });
    await User.update(t.id, { campusId: campusId || null });
    res.redirect(`/superadmin/users/${t.id}`);
  } catch (err) { res.render("error", { title: "Error", message: "Error assigning campus", statusCode: 500 }); }
};

export const resetUserPassword = async (req, res) => {
  const { newPassword } = req.body;
  try {
    const t = await User.findById(req.params.id);
    if (!t) return res.render("error", { title: "Not Found", message: "User not found", statusCode: 404 });
    await User.update(t.id, { password: await bcrypt.hash(newPassword, 10) });
    res.redirect(`/superadmin/users/${t.id}`);
  } catch (err) { res.render("error", { title: "Error", message: "Error resetting password", statusCode: 500 }); }
};

export const deleteUser = async (req, res) => {
  try {
    const t = await User.findById(req.params.id);
    if (!t) return res.render("error", { title: "Not Found", message: "User not found", statusCode: 404 });
    if (t.id === req.user.id) return res.render("error", { title: "Cannot Delete", message: "Cannot delete your own account", statusCode: 400 });
    await User.delete(t.id);
    res.redirect("/superadmin/users");
  } catch (err) { res.render("error", { title: "Error", message: "Error deleting user", statusCode: 500 }); }
};

export const getAnalytics = async (req, res) => {
  try {
    const [campuses, allRequests, allUsers] = await Promise.all([Campus.findAll({ isActive: true }), DocumentRequest.findAll({}), User.findAll({})]);
    const requestsByStatus = Object.entries(allRequests.reduce((a,r) => { a[r.status]=(a[r.status]||0)+1; return a; }, {})).map(([status,count]) => ({ status, count }));
    const requestsByType   = Object.entries(allRequests.reduce((a,r) => { a[r.documentType]=(a[r.documentType]||0)+1; return a; }, {})).map(([documentType,count]) => ({ documentType, count }));
    const campusMap = campuses.reduce((m,c) => { m[c.id]=c; return m; }, {});
    const requestsByCampus = Object.entries(allRequests.reduce((a,r) => { const k=r.campusId||'unknown'; a[k]=(a[k]||0)+1; return a; }, {})).map(([campusId,count]) => ({ campusId, count, campus: campusMap[campusId]||null }));
    const requestsByCampusStatus = Object.values(allRequests.reduce((a,r) => { const k=`${r.campusId||'unknown'}__${r.status}`; if(!a[k]) a[k]={campusId:r.campusId||'unknown',status:r.status,count:0}; a[k].count+=1; return a; }, {}));
    const userStats = {
      byRole:   Object.entries(allUsers.reduce((a,u) => { a[u.role]=(a[u.role]||0)+1; return a; }, {})).map(([role,count]) => ({ role, count })),
      byStatus: Object.entries(allUsers.reduce((a,u) => { a[u.status]=(a[u.status]||0)+1; return a; }, {})).map(([status,count]) => ({ status, count }))
    };
    res.render("superadmin/analytics", { title: "Global Analytics", requestsByStatus, requestsByType, requestsByCampus, requestsByCampusStatus, userStats, campuses, user: req.user });
  } catch (err) {
    console.error("Error fetching analytics:", err);
    res.render("error", { title: "Error", message: "Error fetching analytics", statusCode: 500 });
  }
};

export default { getDashboard, getCampuses, getRequests, getRequestDetails, getUsers, getUserDetails, updateUserRole, updateUserStatus, assignUserCampus, resetUserPassword, deleteUser, getAnalytics };
