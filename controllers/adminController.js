/*
    MinSU DocuReg - Campus Admin Controller (Firestore)
*/
import { User } from "../models/userModel.js";
import { DocumentRequest } from "../models/documentModel.js";
import { Appointment } from "../models/appointmentModel.js";
import { Campus } from "../models/campusModel.js";
import bcrypt from "bcrypt";

export const getDashboard = async (req, res) => {
  try {
    const campusId = req.user.campusId;
    const [totalUsers, totalStudents, totalRegistrars, totalAdmins, activeUsers, suspendedUsers, inactiveUsers,
           totalRequests, pendingRequests, processingRequests, completedRequests,
           totalAppointments, scheduledAppointments, recentUsersRaw, recentRequestsRaw] = await Promise.all([
      User.count({ campusId }), User.count({ campusId, role: 'student' }), User.count({ campusId, role: 'registrar' }), User.count({ campusId, role: 'admin' }),
      User.count({ campusId, status: 'active' }), User.count({ campusId, status: 'suspended' }), User.count({ campusId, status: 'inactive' }),
      DocumentRequest.count({ campusId }), DocumentRequest.count({ campusId, status: 'pending' }), DocumentRequest.count({ campusId, status: 'processing' }), DocumentRequest.count({ campusId, status: 'completed' }),
      Appointment.count({ campusId }), Appointment.count({ campusId, status: 'scheduled' }),
      User.findAll({ campusId }, { orderBy: 'createdAt', orderDir: 'desc', limit: 10 }),
      DocumentRequest.findAll({ campusId }, { orderBy: 'createdAt', orderDir: 'desc', limit: 5 })
    ]);
    const stats = { totalUsers, totalStudents, totalRegistrars, totalAdmins, activeUsers, suspendedUsers, inactiveUsers, totalRequests, pendingRequests, processingRequests, completedRequests, totalAppointments, scheduledAppointments };
    const recentRequests = await Promise.all(recentRequestsRaw.map(async r => ({ ...r, student: await User.findById(r.studentId) || null })));
    res.render("admin/dashboard", { title: "Campus Admin Dashboard", stats, recentUsers: recentUsersRaw, recentRequests, campus: req.user.campus, user: req.user });
  } catch (err) {
    console.error("Admin dashboard error:", err);
    res.render("error", { title: "Error", message: "Error loading dashboard", statusCode: 500 });
  }
};

export const getUsers = async (req, res) => {
  try {
    const { role, status, search } = req.query;
    const conditions = { campusId: req.user.campusId };
    if (role)   conditions.role   = role;
    if (status) conditions.status = status;
    let users = await User.findAll(conditions, { orderBy: 'createdAt', orderDir: 'desc' });
    if (search) { const q = search.toLowerCase(); users = users.filter(u => (u.name && u.name.toLowerCase().includes(q)) || (u.email && u.email.toLowerCase().includes(q)) || (u.studentId && u.studentId.toLowerCase().includes(q))); }
    res.render("admin/users", { title: "User Management", users, campus: req.user.campus, user: req.user, filters: { role, status, search } });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.render("error", { title: "Error", message: "Error fetching users", statusCode: 500 });
  }
};

export const getUserDetails = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.render("error", { title: "Not Found", message: "User not found", statusCode: 404 });
    const userRequests = await DocumentRequest.findAll({ studentId: targetUser.id }, { orderBy: 'createdAt', orderDir: 'desc' });
    res.render("admin/user-details", { title: `User: ${targetUser.name}`, targetUser, userRequests, user: req.user });
  } catch (err) {
    console.error("Error fetching user details:", err);
    res.render("error", { title: "Error", message: "Error fetching user", statusCode: 500 });
  }
};

export const updateUserRole = async (req, res) => {
  const { role } = req.body;
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.render("error", { title: "Not Found", message: "User not found", statusCode: 404 });
    if (targetUser.id === req.user.id) return res.render("error", { title: "Cannot Update", message: "Cannot change your own role", statusCode: 400 });
    await User.update(targetUser.id, { role });
    res.redirect(`/admin/users/${targetUser.id}`);
  } catch (err) {
    console.error("Error updating user role:", err);
    res.render("error", { title: "Error", message: "Error updating user", statusCode: 500 });
  }
};

export const updateUserStatus = async (req, res) => {
  const { status } = req.body;
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.render("error", { title: "Not Found", message: "User not found", statusCode: 404 });
    if (targetUser.id === req.user.id && status !== 'active') return res.render("error", { title: "Cannot Update", message: "Cannot suspend your own account", statusCode: 400 });
    await User.update(targetUser.id, { status });
    res.redirect(`/admin/users/${targetUser.id}`);
  } catch (err) {
    console.error("Error updating user status:", err);
    res.render("error", { title: "Error", message: "Error updating user", statusCode: 500 });
  }
};

export const resetUserPassword = async (req, res) => {
  const { newPassword } = req.body;
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.render("error", { title: "Not Found", message: "User not found", statusCode: 404 });
    await User.update(targetUser.id, { password: await bcrypt.hash(newPassword, 10) });
    res.redirect(`/admin/users/${targetUser.id}`);
  } catch (err) {
    console.error("Error resetting password:", err);
    res.render("error", { title: "Error", message: "Error resetting password", statusCode: 500 });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.render("error", { title: "Not Found", message: "User not found", statusCode: 404 });
    if (targetUser.id === req.user.id) return res.render("error", { title: "Cannot Delete", message: "Cannot delete your own account", statusCode: 400 });
    await User.delete(targetUser.id);
    res.redirect("/admin/users");
  } catch (err) {
    console.error("Error deleting user:", err);
    res.render("error", { title: "Error", message: "Error deleting user", statusCode: 500 });
  }
};

export const getAnalytics = async (req, res) => {
  try {
    const campusId = req.user.campusId;
    const [allRequests, allUsers] = await Promise.all([DocumentRequest.findAll({ campusId }), User.findAll({ campusId })]);
    const requestsByStatus = Object.entries(allRequests.reduce((a, r) => { a[r.status] = (a[r.status]||0)+1; return a; }, {})).map(([status, count]) => ({ status, count }));
    const requestsByType   = Object.entries(allRequests.reduce((a, r) => { a[r.documentType] = (a[r.documentType]||0)+1; return a; }, {})).map(([documentType, count]) => ({ documentType, count }));
    const userStats = {
      byRole:   Object.entries(allUsers.reduce((a, u) => { a[u.role]   = (a[u.role]||0)+1;   return a; }, {})).map(([role,   count]) => ({ role,   count })),
      byStatus: Object.entries(allUsers.reduce((a, u) => { a[u.status] = (a[u.status]||0)+1; return a; }, {})).map(([status, count]) => ({ status, count }))
    };
    res.render("admin/analytics", { title: "Campus Analytics", requestsByStatus, requestsByType, userStats, campus: req.user.campus, user: req.user });
  } catch (err) {
    console.error("Error fetching analytics:", err);
    res.render("error", { title: "Error", message: "Error fetching analytics", statusCode: 500 });
  }
};

export default { getDashboard, getUsers, getUserDetails, updateUserRole, updateUserStatus, resetUserPassword, deleteUser, getAnalytics };
