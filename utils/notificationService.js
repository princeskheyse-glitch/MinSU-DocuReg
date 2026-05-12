/*
    MinSU DocuReg - Notification Service (Firestore)
*/
import { Notification } from "../models/notificationModel.js";

const clients = new Map();

export const addClient = (userId, res) => {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
};

export const removeClient = (userId, res) => {
  if (clients.has(userId)) {
    clients.get(userId).delete(res);
    if (clients.get(userId).size === 0) clients.delete(userId);
  }
};

const pushToUser = (userId, notification) => {
  if (clients.has(userId)) {
    const payload = `data: ${JSON.stringify(notification)}\n\n`;
    clients.get(userId).forEach(res => { try { res.write(payload); } catch (_) {} });
  }
};

export const notify = async ({ userId, type, title, message, link = null }) => {
  try {
    const notif = await Notification.create({ userId, type, title, message, link });
    pushToUser(userId, { id: notif.id, type, title, message, link, createdAt: notif.createdAt });
    return notif;
  } catch (err) {
    console.error("Notification error:", err);
  }
};

const formatType = (type) => {
  const map = {
    transcript: 'Transcript of Records', transfer_credentials: 'Transfer Credentials',
    diploma_copy: '2nd Copy of Diploma', certificate: 'Certificate of Graduation',
    verification: 'Verification Letter', enrollment_certificate: 'Enrollment Certificate',
    good_moral: 'Good Moral Certificate'
  };
  return map[type] || type;
};

export const notifyRequestSubmitted = async (staffUsers, request, studentName) => {
  for (const staff of staffUsers) {
    const basePath = staff.role === 'admin' ? '/admin' : '/registrar';
    await notify({ userId: staff.id, type: 'request_submitted',
      title: 'New Document Request',
      message: `${studentName} submitted a new ${formatType(request.documentType)} request.`,
      link: `${basePath}/requests/${request.id}` });
  }
};

export const notifyStatusUpdate = async (studentId, request, newStatus) => {
  const messages = {
    processing: { title: 'Request Being Processed', msg: `Your ${formatType(request.documentType)} request is now being processed.` },
    ready:      { title: '📦 Document Ready for Pickup!', msg: `Your ${formatType(request.documentType)} is ready. Check your appointment schedule.` },
    completed:  { title: '✅ Request Completed', msg: `Your ${formatType(request.documentType)} request has been completed.` },
    rejected:   { title: '❌ Request Rejected', msg: `Your ${formatType(request.documentType)} request was rejected. Please check the details.` }
  };
  const info = messages[newStatus];
  if (!info) return;
  await notify({ userId: studentId, type: `request_${newStatus}`,
    title: info.title, message: info.msg, link: `/student/requests/${request.id}` });
};

export const notifyAppointmentScheduled = async (studentId, appointment, request) => {
  const date = new Date(appointment.appointmentDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  // Format time: "09:00:00" → "9:00 AM"
  const rawTime = appointment.appointmentTime || '';
  let displayTime = rawTime;
  const timeParts = rawTime.match(/^(\d{1,2}):(\d{2})/);
  if (timeParts) {
    const h = parseInt(timeParts[1]);
    const m = timeParts[2];
    const ampm = h >= 12 ? 'PM' : 'AM';
    displayTime = `${h % 12 || 12}:${m} ${ampm}`;
  }
  await notify({ userId: studentId, type: 'appointment_scheduled',
    title: 'Pickup Appointment Scheduled',
    message: `Your pickup is scheduled on ${date} at ${displayTime}. Please bring a valid ID.`,
    link: `/student/requests/${request.id}` });
};
