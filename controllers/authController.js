/*
    MinSU DocuReg - Auth Controller (Firestore + Google Sign-In)
*/
import bcrypt from "bcrypt";
import { getAuth } from "firebase-admin/auth";
import { User } from "../models/userModel.js";
import { Campus } from "../models/campusModel.js";
import { db } from "../models/db.js";
import crypto from "crypto";

export const loginPage = (req, res) => res.render("login", { title: "Login" });

export const registerPage = async (req, res) => {
  try {
    const campuses = await Campus.findAll({ isActive: true });
    res.render("register", { title: "Register", campuses });
  } catch (err) {
    res.render("register", { title: "Register", campuses: [] });
  }
};

export const forgotPasswordPage = (req, res) =>
  res.render("forgotpassword", { title: "Forgot Password" });

export const dashboardPage = (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  res.render("dashboard", { title: "Dashboard", user: req.user });
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.render("login", { title: "Login", error: "User not found" });
    if (user.status === 'inactive') return res.render("login", { title: "Login", error: "Your account is inactive. Contact administrator." });
    if (user.status === 'suspended') return res.render("login", { title: "Login", error: "Your account has been suspended." });

    // Google-only accounts have no password
    if (!user.password) return res.render("login", { title: "Login", error: "This account uses Google Sign-In. Please use the Google button to sign in." });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render("login", { title: "Login", error: "Incorrect password" });

    req.session.userId   = user.id;
    req.session.userRole = user.role;
    req.session.campusId = user.campusId || null;

    await new Promise((resolve, reject) => {
      req.session.save((err) => err ? reject(err) : resolve());
    });

    if (user.role === 'superadmin') return res.redirect("/superadmin/dashboard");
    if (user.role === 'admin')      return res.redirect("/admin/dashboard");
    if (user.role === 'registrar')  return res.redirect("/registrar/dashboard");
    res.redirect("/student/dashboard");
  } catch (err) {
    console.error("Login error:", err);
    res.render("login", { title: "Login", error: "An error occurred during login" });
  }
};

/**
 * Google Sign-In — called via POST /auth/google with Firebase ID token
 * Flow:
 *   1. Verify ID token with Firebase Admin
 *   2. Find or create user in Firestore
 *   3. If profile incomplete (no campusId), redirect to /complete-profile
 *   4. Otherwise redirect to dashboard
 */
export const googleSignIn = async (req, res) => {
  // Accept idToken from both JSON body (fetch) and form body (form POST)
  const idToken = req.body.idToken;
  console.log('[googleSignIn] Called. idToken present:', !!idToken, '| content-type:', req.headers['content-type']);
  if (!idToken) return res.status(400).json({ error: "No ID token provided" });

  try {
    // Verify the token with Firebase Admin
    console.log('[googleSignIn] Verifying ID token...');
    const decoded = await getAuth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decoded;
    console.log('[googleSignIn] Token verified. email:', email, 'uid:', uid);

    // Find existing user by email
    let user = await User.findOne({ email });
    console.log('[googleSignIn] Existing user found:', !!user, user ? `id=${user.id} role=${user.role} campusId=${user.campusId}` : '');

    if (!user) {
      console.log('[googleSignIn] Creating new user...');
      user = await User.create({
        name: name || email.split('@')[0],
        email,
        password: null,
        googleUid: uid,
        photoURL: picture || null,
        role: 'student',
        campusId: null,
        studentId: null,
        status: 'active',
        profileComplete: false
      });
      console.log('[googleSignIn] New user created. id:', user.id);
    } else {
      if (!user.googleUid) {
        await User.update(user.id, { googleUid: uid, photoURL: picture || user.photoURL || null });
        user.googleUid = uid;
      }
      if (user.status === 'suspended') return res.status(403).json({ error: "Your account has been suspended." });
      if (user.status === 'inactive')  return res.status(403).json({ error: "Your account is inactive. Contact administrator." });
    }

    // Set session
    req.session.userId   = user.id;
    req.session.userRole = user.role;
    req.session.campusId = user.campusId || null;
    console.log('[googleSignIn] Session set. userId:', req.session.userId, 'sessionID:', req.sessionID);

    // Save session explicitly before responding
    console.log('[googleSignIn] Saving session to store...');
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('[googleSignIn] session.save() ERROR:', err);
          return reject(err);
        }
        console.log('[googleSignIn] session.save() SUCCESS. sessionID:', req.sessionID);
        resolve();
      });
    });

    // If profile is incomplete, send to completion page
    const profileComplete = user.profileComplete !== false && user.campusId;
    console.log('[googleSignIn] profileComplete:', profileComplete, '| campusId:', user.campusId, '| profileComplete flag:', user.profileComplete);

    const redirectMap = { superadmin: "/superadmin/dashboard", admin: "/admin/dashboard", registrar: "/registrar/dashboard" };
    const redirectTo = !profileComplete ? "/complete-profile" : (redirectMap[user.role] || "/student/dashboard");
    console.log('[googleSignIn] Creating one-time auth token for redirect...');

    // Generate a one-time token and store it in Firestore
    // The browser will navigate to /auth/callback?token=xxx (full page load)
    // which sets the session cookie properly via server-side redirect
    const token = crypto.randomBytes(32).toString('hex');
    await db.collection('auth_tokens').doc(token).set({
      userId: user.id,
      userRole: user.role,
      campusId: user.campusId || null,
      redirectTo,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000) // 1 minute
    });

    console.log('[googleSignIn] Token created, sending to client');
    return res.json({ redirect: `/auth/callback?token=${token}` });

  } catch (err) {
    console.error("[googleSignIn] CAUGHT ERROR:", err.code, err.message, err.stack);
    return res.status(401).json({ error: "Google sign-in failed: " + (err.message || "Please try again.") });
  }
};

/**
 * Auth callback — exchanges one-time token for a session cookie
 * This is a full browser GET request, so Set-Cookie works reliably
 */
export const authCallback = async (req, res) => {
  const { token } = req.query;
  console.log('[authCallback] token:', token ? token.substring(0, 8) + '...' : 'missing');

  if (!token) return res.redirect('/login?error=missing_token');

  try {
    const tokenDoc = await db.collection('auth_tokens').doc(token).get();

    if (!tokenDoc.exists) {
      console.log('[authCallback] Token not found');
      return res.redirect('/login?error=invalid_token');
    }

    const data = tokenDoc.data();

    // Check expiry
    if (data.expiresAt.toDate() < new Date()) {
      console.log('[authCallback] Token expired');
      await tokenDoc.ref.delete();
      return res.redirect('/login?error=token_expired');
    }

    // Delete token immediately (one-time use)
    await tokenDoc.ref.delete();

    // Set session
    req.session.userId   = data.userId;
    req.session.userRole = data.userRole;
    req.session.campusId = data.campusId || null;

    console.log('[authCallback] Setting session userId:', data.userId);

    // Save session then redirect — this is a full browser request so cookie is set properly
    req.session.save((err) => {
      if (err) {
        console.error('[authCallback] session.save error:', err);
        return res.redirect('/login?error=session_error');
      }
      console.log('[authCallback] Session saved, redirecting to:', data.redirectTo);
      return res.redirect(data.redirectTo);
    });

  } catch (err) {
    console.error('[authCallback] ERROR:', err.message);
    return res.redirect('/login?error=server_error');
  }
};
export const completeProfilePage = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  try {
    const campuses = await Campus.findAll({ isActive: true });
    const user = await User.findById(req.session.userId);
    // If already complete, redirect to dashboard
    if (user && user.campusId) return res.redirect("/student/dashboard");
    res.render("complete-profile", { title: "Complete Your Profile", campuses, user });
  } catch (err) {
    console.error("Complete profile page error:", err);
    res.redirect("/login");
  }
};

/**
 * Save completed profile
 */
export const saveProfile = async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const { campusId, studentId, name } = req.body;

  const renderError = async (error) => {
    const campuses = await Campus.findAll({ isActive: true });
    const user = await User.findById(req.session.userId);
    return res.render("complete-profile", { title: "Complete Your Profile", campuses, user, error });
  };

  try {
    if (!campusId) return renderError("Please select your campus.");
    const campus = await Campus.findById(campusId);
    if (!campus) return renderError("Invalid campus selected.");

    // Check student ID uniqueness if provided
    if (studentId && studentId.trim()) {
      const existingStudentId = await User.findOne({ studentId: studentId.trim() });
      if (existingStudentId && existingStudentId.id !== req.session.userId) {
        return renderError(`Student ID "${studentId.trim()}" is already registered. Please check your ID or contact the Registrar's Office.`);
      }
    }

    await User.update(req.session.userId, {
      campusId,
      studentId: studentId ? studentId.trim() : null,
      name: name || undefined,
      profileComplete: true
    });

    req.session.campusId = campusId;

    await new Promise((resolve, reject) => {
      req.session.save((err) => err ? reject(err) : resolve());
    });

    res.redirect("/student/dashboard");
  } catch (err) {
    console.error("Save profile error:", err);
    return renderError("An error occurred. Please try again.");
  }
};

export const registerUser = async (req, res) => {
  const { name, email, password, studentId, campusId } = req.body;

  const renderError = async (error) => {
    const campuses = await Campus.findAll({ isActive: true });
    return res.render("register", { title: "Register", error, campuses });
  };

  try {
    if (!campusId) return renderError("Please select your campus.");
    const campus = await Campus.findById(campusId);
    if (!campus) return renderError("Invalid campus selected.");
    const existing = await User.findOne({ email });
    if (existing) return renderError("Email already registered.");

    // Check student ID uniqueness if provided
    if (studentId && studentId.trim()) {
      const existingStudentId = await User.findOne({ studentId: studentId.trim() });
      if (existingStudentId) return renderError(`Student ID "${studentId.trim()}" is already registered. Please check your ID or contact the Registrar's Office.`);
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name, email, password: hashed,
      studentId: studentId ? studentId.trim() : null,
      role: 'student', campusId, status: 'active',
      profileComplete: true
    });

    req.session.userId   = user.id;
    req.session.userRole = user.role;
    req.session.campusId = user.campusId;

    await new Promise((resolve, reject) => {
      req.session.save((err) => err ? reject(err) : resolve());
    });

    res.redirect("/student/dashboard");
  } catch (err) {
    console.error("Registration error:", err);
    const campuses = await Campus.findAll({ isActive: true }).catch(() => []);
    res.render("register", { title: "Register", error: err.message || "An error occurred", campuses });
  }
};

export const logoutUser = (req, res) => {
  req.session.destroy();
  res.redirect("/login");
};

export const resetPasswordByEmail = async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;
  try {
    if (newPassword !== confirmPassword)
      return res.render("forgotpassword", { title: "Forgot Password", error: "Passwords do not match" });
    if (newPassword.length < 6)
      return res.render("forgotpassword", { title: "Forgot Password", error: "Password must be at least 6 characters" });
    const user = await User.findOne({ email });
    if (!user)
      return res.render("forgotpassword", { title: "Forgot Password", error: "Email not found in the system" });
    const hashed = await bcrypt.hash(newPassword, 10);
    await User.update(user.id, { password: hashed });
    res.render("forgotpassword", { title: "Forgot Password", success: "Password reset successfully! You can now sign in." });
  } catch (err) {
    console.error("Password reset error:", err);
    res.render("forgotpassword", { title: "Forgot Password", error: "An error occurred" });
  }
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  try {
    if (!req.session.userId) return res.redirect("/login");
    if (newPassword !== confirmPassword)
      return res.status(400).json({ success: false, message: "New passwords do not match" });
    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ success: false, message: "User not found" });
    if (!user.password) return res.status(400).json({ success: false, message: "Google accounts cannot change password here." });
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ success: false, message: "Current password is incorrect" });
    const hashed = await bcrypt.hash(newPassword, 10);
    await User.update(user.id, { password: hashed });
    res.status(200).json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    console.error("Password change error:", err);
    res.status(500).json({ success: false, message: "An error occurred" });
  }
};
