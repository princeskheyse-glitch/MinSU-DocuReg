/**
 * Helper utilities for the CMS application
 * Including formatters and utility functions
 */

/**
 * Format document type enum to readable text
 * @param {string} docType - Document type enum value
 * @returns {string} - Formatted document type
 */
export const formatDocType = (docType) => {
  const docTypeMap = {
    'transcript': 'Transcript of Records',
    'transfer_credentials': 'Certificate of Transfer Credentials and Academic Records',
    'diploma_copy': 'Request for Second Copy of Diploma'
  };
  
  return docTypeMap[docType] || docType;
};

/**
 * Get document icon based on type
 * @param {string} docType - Document type enum value
 * @returns {string} - Font Awesome icon class
 */
export const getDocIcon = (docType) => {
  const iconMap = {
    'transcript': 'graduation-cap',
    'transfer_credentials': 'file-contract',
    'diploma_copy': 'certificate'
  };
  
  return iconMap[docType] || 'file-alt';
};

/**
 * Calculate expected completion date (6 working days from a given date)
 * @param {Date} startDate - The start date to calculate from
 * @returns {Date} - The expected completion date
 */
export const calculateCompletionDate = (startDate = new Date()) => {
  let workingDays = 0;
  const completionDate = new Date(startDate);
  
  while (workingDays < 6) {
    completionDate.setDate(completionDate.getDate() + 1);
    const dayOfWeek = completionDate.getDay();
    // Skip Saturdays (6) and Sundays (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }
  
  return completionDate;
};

/**
 * Format date to readable string
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  const options = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  
  return d.toLocaleDateString('en-US', options);
};

/**
 * Check if a date is within the 6-working-days processing period
 * @param {Date} requestDate - The document request date
 * @returns {boolean} - Whether the document is still being processed
 */
export const isStillProcessing = (requestDate) => {
  const now = new Date();
  const completionDate = calculateCompletionDate(requestDate);
  
  return now < completionDate;
};

/**
 * Auto-schedule a pickup appointment date (3 working days from now, at 9:00 AM)
 * Skips weekends automatically.
 * @param {Date} fromDate - Start date (defaults to now)
 * @returns {{ appointmentDate: Date, appointmentTime: string }}
 */
export const autoSchedulePickupDate = (fromDate = new Date()) => {
  let workingDays = 0;
  const date = new Date(fromDate);

  while (workingDays < 3) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) workingDays++; // skip Sun(0) and Sat(6)
  }

  date.setHours(9, 0, 0, 0);
  return {
    appointmentDate: date,
    appointmentTime: '09:00:00'
  };
};

export default {
  formatDocType,
  getDocIcon,
  calculateCompletionDate,
  formatDate,
  isStillProcessing,
  autoSchedulePickupDate
};
