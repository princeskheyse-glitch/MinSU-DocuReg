# Testing Email Notifications - Quick Start

## 5-Minute Setup for Testing

### Step 1: Create Free Test Email Account
1. Go to https://ethereal.email/
2. Click "Create Ethereal Account"
3. You'll get a test email account (example: `test@ethereal.email`)

### Step 2: Update .env File
Open `.env` in the CMS root directory and change:
```
EMAIL_USER=your-test-email@ethereal.email
EMAIL_PASS=your-test-password
```
(Copy the credentials from the Ethereal account creation page)

### Step 3: Restart Application
Kill the current running app and restart:
```bash
npm run xian
```

### Step 4: Create a Test Appointment
1. Open http://localhost:3000
2. Log in as: `registrar@registrar.edu.ph` / `123`
3. Go to **Registrar Dashboard** → **Appointments** → **Add Appointment**
4. Fill in the form:
   - Student: Select `student@student.com`
   - Document Request: Select any pending/processing request
   - Date: Pick any future date (e.g., Dec 15, 2025)
   - Time: Pick any time (e.g., 10:00 AM)
   - Notes: (Optional) Add any special instructions
5. Click **Create Appointment**

### Step 5: View the Email
Look at the console output. You'll see something like:
```
Appointment notification sent to student@student.com
```

The console might also show a "Preview URL" - click that link to see the formatted email in your browser!

Alternatively:
1. Log in to https://ethereal.email/messages
2. You'll see the test email that was just sent
3. Click on it to see the full formatted email

## What to Look For in the Test Email

✅ Professional green design
✅ Student's name personalized
✅ Clear appointment date & time
✅ Document type shown
✅ Any notes you added
✅ Arrival instructions
✅ University branding

## Notes About Ethereal Email

- ⏰ Emails are temporary (deleted after 24 hours)
- 📨 Perfect for development/testing
- ✅ No real emails sent
- 🔄 Create new account whenever you want fresh testing
- 📸 Easy to see exactly how email looks

## Testing Different Scenarios

### Test 1: With Notes
1. Create appointment WITH notes
2. Verify notes appear in email

### Test 2: Different Times
1. Create multiple appointments at different times
2. Verify each shows correct time in email

### Test 3: Error Handling
1. Delete a student from database (simulate error)
2. Create appointment - system should still work
3. Check console - should show email failed gracefully

## Troubleshooting

### Email not showing up?
1. Check console for error messages
2. Verify EMAIL_USER and EMAIL_PASS are in .env
3. Make sure you restarted the app after updating .env

### "Invalid login" error?
1. Double-check credentials from Ethereal
2. Make sure you copied the entire password
3. Create a new Ethereal account and try again

### Preview URL not showing?
1. Check the full console output
2. Look for "Preview URL: " in the output
3. Make sure you're using Ethereal Email (not Gmail)

## Next Steps: Production Setup

When ready to go live:
1. Replace Ethereal with real email (Gmail or custom SMTP)
2. See `EMAIL_SETUP.md` for Gmail setup
3. Test with real email accounts
4. Update console to not log preview URLs
5. Add email preferences for students (optional)

---

**Questions?** See `EMAIL_SETUP.md` for complete setup documentation.
