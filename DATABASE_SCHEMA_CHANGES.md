# Database Schema Changes

## DocumentRequests Table - Updated Schema

### New/Modified Columns

#### Document Type (MODIFIED)
```sql
documentType ENUM('transcript', 'transfer_credentials', 'diploma_copy') NOT NULL
```

**Changes:**
- Removed: `diploma`, `certificate`, `verification`, `enrollment_certificate`, `good_moral`
- Added: `transfer_credentials`, `diploma_copy`
- Kept: `transcript`

#### Expected Completion Date (NEW)
```sql
expectedCompletionDate DATETIME NULL COMMENT '6 working days from request creation'
```

**Purpose:** Stores the auto-calculated completion date (6 working days excluding weekends from request submission)

#### Appointment Required (NEW)
```sql
appointmentRequired BOOLEAN DEFAULT true COMMENT 'Appointment scheduling is required for document pickup'
```

**Purpose:** Indicates whether an appointment is mandatory for pickup (always true for current implementation)

#### Appointment Scheduled (NEW)
```sql
appointmentScheduled BOOLEAN DEFAULT false
```

**Purpose:** Tracks whether the student has scheduled an appointment for this request

### Migration SQL

For existing databases, run these SQL commands:

```sql
-- 1. Backup the table (optional but recommended)
CREATE TABLE DocumentRequests_backup AS SELECT * FROM DocumentRequests;

-- 2. Modify the enum column (will fail if invalid values exist)
ALTER TABLE DocumentRequests 
MODIFY COLUMN documentType ENUM('transcript', 'transfer_credentials', 'diploma_copy') NOT NULL;

-- 3. Add new columns
ALTER TABLE DocumentRequests 
ADD COLUMN expectedCompletionDate DATETIME NULL AFTER updatedAt,
ADD COLUMN appointmentRequired BOOLEAN DEFAULT true AFTER expectedCompletionDate,
ADD COLUMN appointmentScheduled BOOLEAN DEFAULT false AFTER appointmentRequired;

-- 4. Create index on expectedCompletionDate for performance
CREATE INDEX idx_expectedCompletionDate ON DocumentRequests(expectedCompletionDate);

-- 5. Update existing records (set expected completion to 6 days from creation)
UPDATE DocumentRequests 
SET expectedCompletionDate = DATE_ADD(createdAt, INTERVAL 6 DAY)
WHERE expectedCompletionDate IS NULL;
```

## Working Days Calculation

The system calculates 6 working days by:
1. Starting from the request creation date
2. Incrementing forward one day at a time
3. Counting only weekdays (Monday-Friday)
4. Skipping Saturdays (day 6) and Sundays (day 0)
5. Stopping when 6 working days have been counted

### Example:
- Request submitted: **Monday, Feb 10, 2026**
- Working days counted: Tue, Wed, Thu, Fri, Mon, Tue
- Expected completion: **Tuesday, Feb 17, 2026** (6 working days later, skipping Feb 14-15 weekend)

## Code Implementation Location

### Backend Calculation:
- **File**: `utils/helpers.js`
- **Function**: `calculateCompletionDate(startDate)`

```javascript
export const calculateCompletionDate = (startDate = new Date()) => {
  let workingDays = 0;
  const completionDate = new Date(startDate);
  
  while (workingDays < 6) {
    completionDate.setDate(completionDate.getDate() + 1);
    const dayOfWeek = completionDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip Sun (0) and Sat (6)
      workingDays++;
    }
  }
  
  return completionDate;
};
```

### Usage in Controller:
- **File**: `controllers/studentController.js`
- **Function**: `createRequest()`

```javascript
const expectedCompletionDate = calculateCompletionDate();

const request = await DocumentRequest.create({
  studentId: req.user.id,
  documentType,
  purpose,
  quantity: parseInt(quantity) || 1,
  status: 'pending',
  expectedCompletionDate,
  appointmentRequired: true,
  appointmentScheduled: false
});
```

## Rollback Instructions

If you need to revert these changes:

```sql
-- Remove the new columns
ALTER TABLE DocumentRequests 
DROP COLUMN expectedCompletionDate,
DROP COLUMN appointmentRequired,
DROP COLUMN appointmentScheduled;

-- Restore the original enum values
ALTER TABLE DocumentRequests 
MODIFY COLUMN documentType ENUM(
  'transcript',
  'diploma',
  'certificate',
  'verification',
  'enrollment_certificate',
  'good_moral'
) NOT NULL;

-- Drop the index
DROP INDEX idx_expectedCompletionDate ON DocumentRequests;
```

## Impact Analysis

### Data Loss Considerations:
- ⚠️ If you had existing document requests with types: `diploma`, `certificate`, `verification`, `enrollment_certificate`, or `good_moral`, they will fail to update in the new enum
- ✅ The migration SQL handles this by backing up the table first
- ✅ All existing `transcript` records will be preserved

### Performance Considerations:
- ✅ Index on `expectedCompletionDate` improves filtering queries
- ✅ New boolean columns have minimal performance impact
- ✅ Expected completion date is calculated once at creation time

### Compatibility:
- ✅ Views automatically work with `expectedCompletionDate` using formatting helpers
- ✅ Controllers handle the new fields transparently
- ✅ Email notifications will include completion dates

---

**Schema Version**: 2.0  
**Last Updated**: February 9, 2026
