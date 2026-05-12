# Email Notification Setup Guide

This document explains how to set up email notifications for the MinSU DocuReg system.

## Overview

The system now sends automated email notifications when:
- ✅ An appointment is scheduled for a student
- ✅ A document request status changes (processing, ready, completed, rejected)

## Setup Instructions

### Option 1: Using Gmail (Recommended for Production)

1. **Enable 2-Factor Authentication**
   - Go to https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate App Password**
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer"
   - Google will generate a 16-character password
   - Copy this password (without spaces)

3. **Add to .env file**
   ```
   EMAIL_USER=your-gmail@gmail.com
   EMAIL_PASS=xxxx xxxx xxxx xxxx
   ```

### Option 2: Using Ethereal Email (Perfect for Testing)

Ethereal Email provides temporary test email accounts - perfect for development!

1. **Create Account**
   - Go to https://ethereal.email/
   - Click "Create Ethereal Account"
   - Save your credentials

2. **Add to .env file**
   ```
   EMAIL_USER=your-test@ethereal.email
   EMAIL_PASS=your-password
   ```

3. **View Emails**
   - After sending, click the URL in console output: "Preview URL: ..."
   - Or log in to https://ethereal.email/messages to see all test emails

### Option 3: Using Other Email Services

The system uses Nodemailer, which supports:
- Outlook/Hotmail
- Yahoo Mail
- Custom SMTP servers
- And many more

See [Nodemailer Documentation](https://nodemailer.com/smtp/) for configuration details.

## File Structure

```
CMS/
├── .env                          # Environment variables (local config)
├── .env.example                  # Template for environment variables
├── utils/
│   └── emailService.js          # Email utility functions
└── controllers/
    └── registrarController.js    # Updated with email integration
```

## Email Functions

### sendAppointmentNotification()
Sends a formatted email when an appointment is created.

**Included in email:**
- Student name
- Appointment date & time
- Document type
- Special notes
- Instructions for arrival

**Example usage:**
```javascript
import { sendAppointmentNotification } from '../utils/emailService.js';

await sendAppointmentNotification(student, appointment, documentRequest);
```

### sendStatusUpdateEmail()
Sends a status update when a document request changes status.

**Example usage:**
```javascript
import { sendStatusUpdateEmail } from '../utils/emailService.js';

await sendStatusUpdateEmail(student, request, 'ready');
```

## Testing Emails

### With Ethereal Email:
1. Create a test appointment in the system
2. Check the console for a preview URL
3. Click the URL to see the formatted email
4. No actual email is sent - it's simulated

### With Gmail:
1. Create a test appointment
2. Check the student's Gmail inbox
3. Real email is sent immediately

## Troubleshooting

### "Invalid login: 535-5.7.8 Username and password not accepted"
**Solution:** 
- Double-check your Gmail email address and app password
- Make sure 2-Factor Authentication is enabled
- Regenerate the app password if needed

### "No transport provided"
**Solution:**
- Make sure `.env` file exists in the CMS root directory
- Restart the application after adding `.env`

### Ethereal Email - "Preview URL not showing"
**Solution:**
- Check the console output carefully
- The URL is printed during email send operation
- Emails are automatically deleted after 24 hours

## Production Deployment

For production, it's recommended to:

1. **Use a proper email service provider:**
   - SendGrid
   - Mailgun
   - AWS SES
   - Custom SMTP server

2. **Environment Security:**
   - Never commit `.env` to version control
   - Use a `.gitignore` file:
     ```
     .env
     node_modules/
     ```

3. **Error Handling:**
   - The email service gracefully handles failures
   - Appointment creation succeeds even if email fails
   - Check console logs for email-related errors

## Email Templates

All emails include:
- Professional HTML formatting
- Green color scheme (matching app theme)
- Responsive design for mobile and desktop
- Clear call-to-action information
- University branding

## Support

For issues with:
- **Gmail setup:** Visit https://support.google.com/mail
- **Ethereal Email:** Visit https://ethereal.email/
- **Nodemailer:** Visit https://nodemailer.com/

## Future Enhancements

Possible additions:
- Email templates for status updates
- Document pickup reminders
- Bulk email notifications
- Email preferences/unsubscribe option
- SMS notifications as alternative
