/*
    MinSU DocuReg - Registrar Controller (Firestore)
*/
import { DocumentRequest } from "../models/documentModel.js";
import { Appointment } from "../models/appointmentModel.js";
import { User } from "../models/userModel.js";
import { Campus } from "../models/campusModel.js";
import { sendAppointmentNotification } from "../utils/emailService.js";
import { autoSchedulePickupDate } from "../utils/helpers.js";
import { notifyStatusUpdate, notifyAppointmentScheduled } from "../utils/notificationService.js";

const autoCreateAppointment = async (request, registrarId) => {
  const { appointmentDate, appointmentTime } = autoSchedulePickupDate();
  const appointment = await Appointment.create({
    documentRequestId: request.id,
    studentId: request.studentId,
    campusId: request.campusId || null,
    appointmentDate,
    appointmentTime,
    status: 'scheduled',
    notes: 'Auto-scheduled pickup appointment'
  });
  await DocumentRequest.update(request.id, { processedBy: registrarId });
  const student = await User.findById(request.studentId);
  if (student) {
    await sendAppointmentNotification(student, appointment, request);
    await notifyAppointmentScheduled(student.id, appointment, request);
  }
  return appointment;
};

export const getDashboard = async (req, res) => {
  try {
    const campusId = req.user.campusId;
    const [pending, processing, ready, total, allAppts] = await Promise.all([
      DocumentRequest.count({ campusId, status: 'pending' }),
      DocumentRequest.count({ campusId, status: 'processing' }),
      DocumentRequest.count({ campusId, status: 'ready' }),
      DocumentRequest.count({ campusId }),
      Appointment.findAll({ campusId }, { orderBy: 'appointmentDate' })
    ]);
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);
    const todayAppointments = allAppts.filter(a => { const d = new Date(a.appointmentDate); return d >= todayStart && d <= todayEnd; }).length;
    const stats = { pendingRequests: pending, processingRequests: processing, readyRequests: ready, totalRequests: total, todayAppointments };
    const rawRecent = await DocumentRequest.findAll({ campusId }, { orderBy: 'createdAt', orderDir: 'desc', limit: 10 });
    const recentRequests = await Promise.all(rawRecent.map(async r => ({ ...r, student: await User.findById(r.studentId) || null })));
    res.render("registrar/dashboard", { title: "Registrar Dashboard", stats, recentRequests, campus: req.user.campus, user: req.user });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.render("error", { title: "Error", message: "Error loading dashboard", statusCode: 500 });
  }
};

export const getPendingRequests = async (req, res) => {
  try {
    const raw = await DocumentRequest.findAll({ status: 'pending', campusId: req.user.campusId }, { orderBy: 'createdAt', orderDir: 'asc' });
    const requests = await Promise.all(raw.map(async r => ({ ...r, student: await User.findById(r.studentId) || null })));
    const basePath = req.user.role === 'admin' ? '/admin' : '/registrar';
    res.render("registrar/pending-requests", { title: "Pending Document Requests", requests, campus: req.user.campus, user: req.user, basePath });
  } catch (err) {
    console.error("Error fetching pending requests:", err);
    res.render("error", { title: "Error", message: "Error fetching requests", statusCode: 500 });
  }
};

export const getRequestDetails = async (req, res) => {
  try {
    const request = await DocumentRequest.findById(req.params.id);
    if (!request) return res.render("error", { title: "Not Found", message: "Request not found", statusCode: 404 });
    const [student, registrar, appointments] = await Promise.all([
      User.findById(request.studentId),
      request.processedBy ? User.findById(request.processedBy) : Promise.resolve(null),
      Appointment.findAll({ documentRequestId: request.id })
    ]);
    const basePath = req.user.role === 'admin' ? '/admin' : '/registrar';
    res.render("registrar/request-details", { title: "Process Request", request: { ...request, student: student || null, registrar: registrar || null }, appointments, user: req.user, basePath });
  } catch (err) {
    console.error("Error fetching request details:", err);
    res.render("error", { title: "Error", message: "Error fetching request", statusCode: 500 });
  }
};

export const updateRequestStatus = async (req, res) => {
  const { status, notes, rejectionReason } = req.body;
  try {
    const request = await DocumentRequest.findById(req.params.id);
    if (!request) return res.render("error", { title: "Not Found", message: "Request not found", statusCode: 404 });
    const updated = await DocumentRequest.update(request.id, {
      status, notes: notes || request.notes,
      rejectionReason: status === 'rejected' ? rejectionReason : null,
      processedBy: req.user.id,
      completedAt: ['completed','rejected'].includes(status) ? new Date() : request.completedAt
    });
    await notifyStatusUpdate(request.studentId, updated, status);
    if (status === 'ready') await autoCreateAppointment(updated, req.user.id);
    const basePath = req.user.role === 'admin' ? '/admin' : '/registrar';
    res.redirect(`${basePath}/requests/${request.id}`);
  } catch (err) {
    console.error("Error updating request:", err);
    res.render("error", { title: "Error", message: "Error updating request", statusCode: 500 });
  }
};

export const markReadyForPickup = async (req, res) => {
  try {
    const request = await DocumentRequest.findById(req.params.id);
    if (!request) return res.render("error", { title: "Not Found", message: "Request not found", statusCode: 404 });
    const updated = await DocumentRequest.update(request.id, { status: 'ready', processedBy: req.user.id });
    await notifyStatusUpdate(request.studentId, updated, 'ready');
    await autoCreateAppointment(updated, req.user.id);
    const basePath = req.user.role === 'admin' ? '/admin' : '/registrar';
    res.redirect(`${basePath}/requests/${request.id}`);
  } catch (err) {
    console.error("Error marking ready:", err);
    res.render("error", { title: "Error", message: "Error updating status", statusCode: 500 });
  }
};

export const completeRequest = async (req, res) => {
  try {
    const request = await DocumentRequest.findById(req.params.id);
    if (!request) return res.render("error", { title: "Not Found", message: "Request not found", statusCode: 404 });
    const updated = await DocumentRequest.update(request.id, { status: 'completed', processedBy: req.user.id, completedAt: new Date() });
    await notifyStatusUpdate(request.studentId, updated, 'completed');
    const basePath = req.user.role === 'admin' ? '/admin' : '/registrar';
    res.redirect(`${basePath}/dashboard`);
  } catch (err) {
    console.error("Error completing request:", err);
    res.render("error", { title: "Error", message: "Error completing request", statusCode: 500 });
  }
};

export const getAppointments = async (req, res) => {
  try {
    const raw = await Appointment.findAll({}, { orderBy: 'appointmentDate', orderDir: 'asc' });
    const appointments = await Promise.all(raw.map(async a => {
      const [student, documentRequest] = await Promise.all([User.findById(a.studentId), DocumentRequest.findById(a.documentRequestId)]);
      return { ...a, student: student || null, documentRequest: documentRequest || null };
    }));
    const stats = {
      scheduled: appointments.filter(a => a.status === 'scheduled').length,
      completed: appointments.filter(a => a.status === 'completed').length,
      missed: appointments.filter(a => a.status === 'missed' || a.status === 'cancelled').length
    };
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7*24*60*60*1000);
    const upcomingAppointments = appointments.filter(a => { const d = new Date(a.appointmentDate); return a.status === 'scheduled' && d >= now && d <= in7Days; });
    res.render("registrar/appointments", { title: "Appointments Schedule", appointments, stats, upcomingAppointments, user: req.user, basePath: req.user.role === 'admin' ? '/admin' : '/registrar' });
  } catch (err) {
    console.error("Error fetching appointments:", err);
    res.render("error", { title: "Error", message: "Error fetching appointments", statusCode: 500 });
  }
};

export const getNewAppointmentForm = async (req, res) => {
  try {
    const raw = await DocumentRequest.findAll({ status: 'ready' });
    const readyRequests = await Promise.all(raw.map(async r => ({ ...r, student: await User.findById(r.studentId) || null })));
    res.render("registrar/new-appointment", { title: "Schedule Appointment", readyRequests, user: req.user, basePath: req.user.role === 'admin' ? '/admin' : '/registrar' });
  } catch (err) {
    console.error("Error loading appointment form:", err);
    res.render("error", { title: "Error", message: "Error loading form", statusCode: 500 });
  }
};

export const createAppointment = async (req, res) => {
  const { documentRequestId, appointmentDate, appointmentTime, notes } = req.body;
  try {
    const request = await DocumentRequest.findById(documentRequestId);
    if (!request) return res.render("error", { title: "Not Found", message: "Document request not found", statusCode: 404 });
    await Appointment.create({ documentRequestId, studentId: request.studentId, campusId: request.campusId || null, appointmentDate, appointmentTime, status: 'scheduled', notes: notes || null });
    const basePath = req.user.role === 'admin' ? '/admin' : '/registrar';
    res.redirect(`${basePath}/appointments`);
  } catch (err) {
    console.error("Error creating appointment:", err);
    res.render("error", { title: "Error", message: "Error creating appointment", statusCode: 500 });
  }
};

export const updateAppointmentStatus = async (req, res) => {
  const { status, notes } = req.body;
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.render("error", { title: "Not Found", message: "Appointment not found", statusCode: 404 });
    await Appointment.update(appointment.id, { status, registrarNotes: notes || appointment.registrarNotes });

    // When appointment is marked completed, also complete the document request and notify student
    if (status === 'completed' && appointment.documentRequestId) {
      const request = await DocumentRequest.findById(appointment.documentRequestId);
      if (request && request.status !== 'completed') {
        const updated = await DocumentRequest.update(request.id, {
          status: 'completed',
          processedBy: req.user.id,
          completedAt: new Date()
        });
        await notifyStatusUpdate(request.studentId, updated, 'completed');
      }
    }

    const basePath = req.user.role === 'admin' ? '/admin' : '/registrar';
    res.redirect(`${basePath}/appointments`);
  } catch (err) {
    console.error("Error updating appointment:", err);
    res.render("error", { title: "Error", message: "Error updating appointment", statusCode: 500 });
  }
};

export const generateReport = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const conditions = {};
    if (status) conditions.status = status;
    let requests = await DocumentRequest.findAll(conditions);
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate); end.setHours(23,59,59,999);
      requests = requests.filter(r => { const d = new Date(r.createdAt); return d >= start && d <= end; });
    }
    res.render("registrar/report", { title: "Document Request Report", requests, user: req.user, filters: { startDate, endDate, status } });
  } catch (err) {
    console.error("Error generating report:", err);
    res.render("error", { title: "Error", message: "Error generating report", statusCode: 500 });
  }
};

export default { getDashboard, getPendingRequests, getRequestDetails, updateRequestStatus, markReadyForPickup, completeRequest, getAppointments, getNewAppointmentForm, createAppointment, updateAppointmentStatus, generateReport };
