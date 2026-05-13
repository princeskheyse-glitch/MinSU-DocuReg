
import express from "express";
import { homePage } from "../controllers/homeController.js";
import { loginPage, registerPage, forgotPasswordPage, dashboardPage, loginUser, registerUser, logoutUser, resetPasswordByEmail, changePassword, googleSignIn, authCallback, completeProfilePage, saveProfile } from "../controllers/authController.js";
import * as studentController from "../controllers/studentController.js";
import * as registrarController from "../controllers/registrarController.js";
import * as adminController from "../controllers/adminController.js";
import * as superAdminController from "../controllers/superAdminController.js";
import * as notifController from "../controllers/notificationController.js";
import { requireAuth, requireRole, requireSuperAdmin, attachUser } from "../middleware/rbacMiddleware.js";

const router = express.Router();

// Attach user (with campus) to every request
router.use(attachUser);

// ── Public routes ──
router.get("/", homePage);
router.get("/login", loginPage);
router.post("/login", loginUser);
router.get("/register", registerPage);
router.post("/register", registerUser);
router.get("/forgot-password", forgotPasswordPage);
router.post("/forgot-password", resetPasswordByEmail);
router.post("/change-password", requireAuth, changePassword);
router.get("/logout", logoutUser);

// ── Google Sign-In ──
router.post("/auth/google", googleSignIn);
router.get("/auth/callback", authCallback);

// ── Session diagnostic (temporary — remove after debugging) ──
router.get("/debug/session", (req, res) => {
  res.json({
    sessionID: req.sessionID,
    session: req.session,
    cookies: req.headers.cookie || 'none'
  });
});

// ── Session verify — confirms session is readable after auth ──
router.get("/auth/verify-session", (req, res) => {
  console.log('[verify-session] sessionID:', req.sessionID, 'userId:', req.session?.userId);
  res.json({
    authenticated: !!req.session?.userId,
    userId: req.session?.userId || null,
    role: req.session?.userRole || null
  });
});

router.get("/complete-profile",  requireAuth, completeProfilePage);
router.post("/complete-profile", requireAuth, saveProfile);

// ── Student routes ──
router.get("/student/dashboard",        requireRole('student'), studentController.getDashboard);
router.get("/student/requests",         requireRole('student'), studentController.getMyRequests);
router.get("/student/request/new",      requireRole('student'), studentController.getRequestForm);
router.post("/student/request/create",  requireRole('student'), studentController.createRequest);
router.get("/student/requests/:id",     requireRole('student'), studentController.getRequestDetails);
router.post("/student/requests/:id/cancel", requireRole('student'), studentController.cancelRequest);

// ── Registrar routes (campus-scoped) ──
router.get("/registrar/dashboard",                  requireRole('registrar', 'admin'), registrarController.getDashboard);
router.get("/registrar/requests",                   requireRole('registrar', 'admin'), registrarController.getPendingRequests);
router.get("/registrar/requests/:id",               requireRole('registrar', 'admin'), registrarController.getRequestDetails);
router.post("/registrar/requests/:id/status",       requireRole('registrar', 'admin'), registrarController.updateRequestStatus);
router.post("/registrar/requests/:id/ready",        requireRole('registrar', 'admin'), registrarController.markReadyForPickup);
router.post("/registrar/requests/:id/complete",     requireRole('registrar', 'admin'), registrarController.completeRequest);
router.get("/registrar/appointments",               requireRole('registrar', 'admin'), registrarController.getAppointments);
router.get("/registrar/appointments/new",           requireRole('registrar', 'admin'), registrarController.getNewAppointmentForm);
router.post("/registrar/appointments/new",          requireRole('registrar', 'admin'), registrarController.createAppointment);
router.post("/registrar/appointments/:id/status",   requireRole('registrar', 'admin'), registrarController.updateAppointmentStatus);
router.get("/registrar/report",                     requireRole('registrar', 'admin'), registrarController.generateReport);

// ── Campus Admin routes (scoped to their campus) ──
router.get("/admin/dashboard",                  requireRole('admin'), adminController.getDashboard);
router.get("/admin/users",                      requireRole('admin'), adminController.getUsers);
router.get("/admin/users/:id",                  requireRole('admin'), adminController.getUserDetails);
router.post("/admin/users/:id/role",            requireRole('admin'), adminController.updateUserRole);
router.post("/admin/users/:id/status",          requireRole('admin'), adminController.updateUserStatus);
router.post("/admin/users/:id/reset-password",  requireRole('admin'), adminController.resetUserPassword);
router.post("/admin/users/:id/delete",          requireRole('admin'), adminController.deleteUser);
router.get("/admin/analytics",                  requireRole('admin'), adminController.getAnalytics);

// Admin can also access registrar functions for their campus
router.get("/admin/requests",                   requireRole('admin'), registrarController.getPendingRequests);
router.get("/admin/requests/:id",               requireRole('admin'), registrarController.getRequestDetails);
router.post("/admin/requests/:id/status",       requireRole('admin'), registrarController.updateRequestStatus);
router.post("/admin/requests/:id/ready",        requireRole('admin'), registrarController.markReadyForPickup);
router.post("/admin/requests/:id/complete",     requireRole('admin'), registrarController.completeRequest);
router.get("/admin/appointments",               requireRole('admin'), registrarController.getAppointments);
router.get("/admin/appointments/new",           requireRole('admin'), registrarController.getNewAppointmentForm);
router.post("/admin/appointments/new",          requireRole('admin'), registrarController.createAppointment);
router.post("/admin/appointments/:id/status",   requireRole('admin'), registrarController.updateAppointmentStatus);
router.get("/admin/report",                     requireRole('admin'), registrarController.generateReport);

// ── Super Admin routes (global, all campuses) ──
router.get("/superadmin/dashboard",                     requireSuperAdmin, superAdminController.getDashboard);
router.get("/superadmin/campuses",                      requireSuperAdmin, superAdminController.getCampuses);
router.get("/superadmin/requests",                      requireSuperAdmin, superAdminController.getRequests);
router.get("/superadmin/requests/:id",                  requireSuperAdmin, superAdminController.getRequestDetails);
router.get("/superadmin/users",                         requireSuperAdmin, superAdminController.getUsers);
router.get("/superadmin/users/:id",                     requireSuperAdmin, superAdminController.getUserDetails);
router.post("/superadmin/users/:id/role",               requireSuperAdmin, superAdminController.updateUserRole);
router.post("/superadmin/users/:id/status",             requireSuperAdmin, superAdminController.updateUserStatus);
router.post("/superadmin/users/:id/campus",             requireSuperAdmin, superAdminController.assignUserCampus);
router.post("/superadmin/users/:id/reset-password",     requireSuperAdmin, superAdminController.resetUserPassword);
router.post("/superadmin/users/:id/delete",             requireSuperAdmin, superAdminController.deleteUser);
router.get("/superadmin/analytics",                     requireSuperAdmin, superAdminController.getAnalytics);

// ── Notification routes ──
router.get("/notifications/stream",     requireAuth, notifController.sseStream);
router.get("/notifications",            requireAuth, notifController.getNotifications);
router.post("/notifications/read-all",  requireAuth, notifController.markAllRead);
router.post("/notifications/:id/read",  requireAuth, notifController.markOneRead);

// Legacy
router.get("/dashboard", requireAuth, dashboardPage);

export default router;
