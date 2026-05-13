/*
    MinSU DocuReg - RBAC Middleware (Firestore)
*/
import { User } from "../models/userModel.js";
import { Campus } from "../models/campusModel.js";

const getUserWithCampus = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return null;
  if (user.campusId) {
    user.campus = await Campus.findById(user.campusId);
  }
  return user;
};

export const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.redirect("/login");
  next();
};

export const requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    console.log(`[requireRole] path=${req.path} sessionID=${req.sessionID} userId=${req.session?.userId} allowedRoles=${allowedRoles}`);
    if (!req.session.userId) {
      console.log('[requireRole] No userId in session — redirecting to /login');
      return res.redirect("/login");
    }
    try {
      const user = await getUserWithCampus(req.session.userId);
      if (!user) {
        console.log('[requireRole] User not found in DB for userId:', req.session.userId, '— destroying session');
        req.session.destroy();
        return res.redirect("/login");
      }
      if (user.role === 'superadmin' || allowedRoles.includes(user.role)) {
        req.user = user;
        return next();
      }
      return res.status(403).render("error", {
        title: "Access Denied",
        message: "You do not have permission to access this page",
        statusCode: 403
      });
    } catch (err) {
      console.error("[requireRole] ERROR fetching user:", err.message);
      // Don't destroy session on DB error — just pass through with session userId
      // This prevents logout on temporary Firestore failures
      req.user = { id: req.session.userId, role: req.session.userRole, campusId: req.session.campusId };
      return next();
    }
  };
};

export const requireSuperAdmin = async (req, res, next) => {
  if (!req.session.userId) return res.redirect("/login");
  try {
    const user = await getUserWithCampus(req.session.userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).render("error", {
        title: "Access Denied",
        message: "Only Super Administrators can access this page",
        statusCode: 403
      });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error("SuperAdmin RBAC Error:", err);
    res.status(500).send("Server error");
  }
};

export const requireStaff = (req, res, next) =>
  requireRole('admin', 'registrar')(req, res, next);

export const attachUser = async (req, res, next) => {
  if (req.session.userId) {
    try {
      req.user = await getUserWithCampus(req.session.userId);
      if (!req.user) {
        console.log('[attachUser] userId in session but user not found in DB:', req.session.userId);
      }
    } catch (err) {
      console.error("[attachUser] ERROR:", err.message);
      // Don't crash — use session data as fallback
      req.user = { id: req.session.userId, role: req.session.userRole, campusId: req.session.campusId, name: 'User' };
    }
  }
  next();
};

export const campusScope = (user) => {
  if (user.role === 'superadmin') return {};
  return { campusId: user.campusId };
};

export default { requireAuth, requireRole, requireSuperAdmin, requireStaff, attachUser, campusScope };
