import nodemailer from 'nodemailer';

/**
 * Email service for sending notifications
 * Uses Gmail SMTP (you can change this to any email provider)
 */

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

/**
 * Send appointment notification email to student
 * @param {Object} student - Student object with name and email
 * @param {Object} appointment - Appointment object with date, time, and remarks
 * @param {Object} documentRequest - DocumentRequest object with documentType
 * @returns {Promise}
 */
export const sendAppointmentNotification = async (student, appointment, documentRequest) => {
  try {
    // Format date and time for display
    const appointmentDate = new Date(appointment.appointmentDate);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
    
    const formattedTime = appointment.appointmentTime || 'To be confirmed';

    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@minsu-docureg.com',
      to: student.email,
      subject: 'Appointment Scheduled - MinSU DocuReg',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Appointment Confirmed</h1>
          </div>
          
          <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">Hi <strong>${student.name}</strong>,</p>
            
            <p style="font-size: 14px; color: #374151; margin: 0 0 25px 0;">
              Your appointment for <strong>${documentRequest?.documentType || 'Document Request'}</strong> has been successfully scheduled.
            </p>

            <div style="background-color: white; border-left: 4px solid #10b981; padding: 20px; margin-bottom: 25px; border-radius: 4px;">
              <h3 style="margin: 0 0 15px 0; color: #059669;">Appointment Details</h3>
              
              <div style="margin-bottom: 12px;">
                <p style="margin: 0; color: #6b7280; font-size: 13px; text-transform: uppercase;">Date</p>
                <p style="margin: 5px 0 0 0; color: #1f2937; font-size: 16px; font-weight: bold;">${formattedDate}</p>
              </div>

              <div style="margin-bottom: 12px;">
                <p style="margin: 0; color: #6b7280; font-size: 13px; text-transform: uppercase;">Time</p>
                <p style="margin: 5px 0 0 0; color: #1f2937; font-size: 16px; font-weight: bold;">${formattedTime}</p>
              </div>

              <div style="margin-bottom: 12px;">
                <p style="margin: 0; color: #6b7280; font-size: 13px; text-transform: uppercase;">Document Type</p>
                <p style="margin: 5px 0 0 0; color: #1f2937; font-size: 16px; font-weight: bold;">${documentRequest?.documentType || 'N/A'}</p>
              </div>

              ${appointment.remarks ? `
                <div>
                  <p style="margin: 0; color: #6b7280; font-size: 13px; text-transform: uppercase;">Remarks</p>
                  <p style="margin: 5px 0 0 0; color: #1f2937; font-size: 14px;">${appointment.remarks}</p>
                </div>
              ` : ''}
            </div>

            <div style="background-color: #ecfdf5; border: 1px solid #d1fae5; padding: 15px; border-radius: 4px; margin-bottom: 25px;">
              <p style="margin: 0; color: #065f46; font-size: 14px;">
                <strong>Please arrive 5-10 minutes before your scheduled time.</strong> If you need to reschedule or cancel, please contact the registrar's office as soon as possible.
              </p>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin: 0 0 10px 0;">
              If you have any questions or concerns, please don't hesitate to contact us.
            </p>

            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                <strong>MinSU DocuReg System</strong><br>
                Mindoro State University - Registrar's Office<br>
                <em>This is an automated notification. Please do not reply to this email.</em>
              </p>
            </div>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Appointment notification sent to ${student.email}`);
    return true;
  } catch (err) {
    console.error('Error sending appointment notification:', err);
    // Don't throw error - just log it so appointment creation still succeeds
    return false;
  }
};

/**
 * Send document request status update email
 * @param {Object} student - Student object
 * @param {Object} request - DocumentRequest object
 * @param {String} status - New status
 * @returns {Promise}
 */
export const sendStatusUpdateEmail = async (student, request, status) => {
  try {
    const statusColors = {
      'processing': '#3b82f6',
      'ready': '#10b981',
      'completed': '#059669',
      'rejected': '#ef4444'
    };

    const statusMessages = {
      'processing': 'Your document request is now being processed.',
      'ready': 'Your document is ready for pickup!',
      'completed': 'Your document has been completed.',
      'rejected': 'Your document request has been rejected.'
    };

    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@minsu-docureg.com',
      to: student.email,
      subject: `Document Request Status Update - MinSU DocuReg`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Status Update</h1>
          </div>
          
          <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">Hi <strong>${student.name}</strong>,</p>
            
            <p style="font-size: 14px; color: #374151; margin: 0 0 25px 0;">
              ${statusMessages[status] || 'Your document request status has been updated.'}
            </p>

            <div style="background-color: white; border-left: 4px solid ${statusColors[status] || '#10b981'}; padding: 20px; margin-bottom: 25px; border-radius: 4px;">
              <h3 style="margin: 0 0 15px 0; color: #059669;">Request Details</h3>
              <p style="margin: 5px 0; color: #1f2937;"><strong>Document Type:</strong> ${request.documentType}</p>
              <p style="margin: 5px 0; color: #1f2937;"><strong>Status:</strong> <span style="background-color: ${statusColors[status] || '#10b981'}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; text-transform: capitalize;">${status}</span></p>
            </div>

            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                <strong>MinSU DocuReg System</strong><br>
                Mindoro State University - Registrar's Office<br>
                <em>This is an automated notification. Please do not reply to this email.</em>
              </p>
            </div>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Status update email sent to ${student.email}`);
    return true;
  } catch (err) {
    console.error('Error sending status update email:', err);
    return false;
  }
};
