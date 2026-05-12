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
    if (!req.session.userId) return res.redirect("/login");
    try {
      const user = await getUserWithCampus(req.session.userId);
      if (!user) { req.session.destroy(); return res.redirect("/login"); }
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
      console.error("RBAC Error:", err);
      res.status(500).send("Server error");
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
    } catch (err) {
      console.error("Error attaching user:", err);
    }
  }
  next();
};

export const campusScope = (user) => {
  if (user.role === 'superadmin') return {};
  return { campusId: user.campusId };
};

export default { requireAuth, requireRole, requireSuperAdmin, requireStaff, attachUser, campusScope };
