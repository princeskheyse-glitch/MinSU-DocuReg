/*
    MinSU DocuReg - Notification Controller (Firestore)
*/
import { Notification } from "../models/notificationModel.js";
import { addClient, removeClient } from "../utils/notificationService.js";

export const sseStream = (req, res) => {
  if (!req.session.userId) return res.status(401).end();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (_) { clearInterval(heartbeat); }
  }, 25000);

  const userId = req.session.userId;
  addClient(userId, res);
  req.on('close', () => { clearInterval(heartbeat); removeClient(userId, res); });
};

export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.findAll(
      { userId: req.session.userId }, { limit: 20 }
    );
    const unreadCount = notifications.filter(n => !n.isRead).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

export const markAllRead = async (req, res) => {
  try {
    await Notification.updateWhere(
      { userId: req.session.userId, isRead: false },
      { isRead: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
};

export const markOneRead = async (req, res) => {
  try {
    await Notification.update(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};
