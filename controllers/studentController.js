/*
    MinSU DocuReg - Student Controller (Firestore)
*/
import { DocumentRequest } from "../models/documentModel.js";
import { Appointment } from "../models/appointmentModel.js";
import { User } from "../models/userModel.js";
import { notifyRequestSubmitted } from "../utils/notificationService.js";

export const getDashboard = async (req, res) => {
  try {
    const allRequests = await DocumentRequest.findAll({ studentId: req.user.id }, { orderBy: 'createdAt', orderDir: 'desc' });
    const recentRequests = allRequests.slice(0, 5);
    const rawUpcoming = await Appointment.findAll({ studentId: req.user.id, status: ['scheduled','rescheduled'] }, { orderBy: 'appointmentDate', orderDir: 'asc', limit: 5 });
    const upcomingAppointments = await Promise.all(rawUpcoming.map(async a => ({ ...a, documentRequest: await DocumentRequest.findById(a.documentRequestId) || null })));
    res.render("student/dashboard", {
      title: "Student Dashboard", user: req.user,
      stats: {
        total: allRequests.length,
        pending: allRequests.filter(r => r.status === 'pending').length,
        completed: allRequests.filter(r => r.status === 'completed').length,
        processing: allRequests.filter(r => r.status === 'processing').length,
        ready: allRequests.filter(r => r.status === 'ready').length
      },
      recentRequests, upcomingAppointments
    });
  } catch (err) {
    console.error("Error fetching dashboard:", err);
    res.render("student/dashboard", { title: "Student Dashboard", user: req.user, stats: { total:0, pending:0, completed:0, processing:0, ready:0 }, recentRequests: [], upcomingAppointments: [] });
  }
};

export const getMyRequests = async (req, res) => {
  try {
    const requests = await DocumentRequest.findAll({ studentId: req.user.id }, { orderBy: 'createdAt', orderDir: 'desc' });
    res.render("student/requests", { title: "My Document Requests", requests, user: req.user });
  } catch (err) {
    console.error("Error fetching requests:", err);
    res.render("error", { title: "Error", message: "Error fetching requests", statusCode: 500 });
  }
};

export const getRequestForm = (req, res) => res.render("student/request-form", { title: "Request Document", user: req.user });

export const createRequest = async (req, res) => {
  const { documentType, purpose, quantity } = req.body;
  try {
    const request = await DocumentRequest.create({ studentId: req.user.id, campusId: req.user.campusId, documentType, purpose, quantity: parseInt(quantity) || 1, status: 'pending' });
    const staff = await User.findAll({ campusId: req.user.campusId, role: ['registrar','admin'], status: 'active' });
    await notifyRequestSubmitted(staff, request, req.user.name);
    res.redirect(`/student/requests/${request.id}`);
  } catch (err) {
    console.error("Error creating request:", err);
    res.render("student/request-form", { title: "Request Document", user: req.user, error: "Error creating request" });
  }
};

export const getRequestDetails = async (req, res) => {
  try {
    const request = await DocumentRequest.findById(req.params.id);
    if (!request) return res.render("error", { title: "Not Found", message: "Request not found", statusCode: 404 });
    if (request.studentId !== req.user.id) return res.render("error", { title: "Unauthorized", message: "You do not have permission to view this request", statusCode: 403 });
    const [student, registrar, appointments] = await Promise.all([
      User.findById(request.studentId),
      request.processedBy ? User.findById(request.processedBy) : Promise.resolve(null),
      Appointment.findAll({ documentRequestId: request.id })
    ]);
    res.render("student/request-details", { title: "Request Details", request: { ...request, student: student || null, registrar: registrar || null }, appointments, user: req.user });
  } catch (err) {
    console.error("Error fetching request details:", err);
    res.render("error", { title: "Error", message: "Error fetching request", statusCode: 500 });
  }
};

export const cancelRequest = async (req, res) => {
  try {
    const request = await DocumentRequest.findById(req.params.id);
    if (!request) return res.render("error", { title: "Not Found", message: "Request not found", statusCode: 404 });
    if (request.studentId !== req.user.id) return res.render("error", { title: "Unauthorized", message: "You do not have permission to cancel this request", statusCode: 403 });
    if (['processing','completed'].includes(request.status)) return res.render("error", { title: "Cannot Cancel", message: "Cannot cancel this request. It is already being processed or completed.", statusCode: 400 });
    await DocumentRequest.update(request.id, { status: 'rejected', rejectionReason: 'Cancelled by student' });
    res.redirect("/student/dashboard");
  } catch (err) {
    console.error("Error cancelling request:", err);
    res.render("error", { title: "Error", message: "Error cancelling request", statusCode: 500 });
  }
};

export default { getDashboard, getMyRequests, getRequestForm, createRequest, getRequestDetails, cancelRequest };
