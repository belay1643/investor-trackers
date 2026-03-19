# Forgot Password Flow

## Overview
The forgot password feature uses OTP (One-Time Password) verification sent via email.

## Flow Steps

1. **Enter Email** → User enters their registered email
2. **Verify Email** → System checks if email exists (lookup is now case‑insensitive and trims whitespace) and sends OTP.  
> **Note:** Gmail accounts often put message into spam when the sender is another Gmail address; use a proper mail provider or custom domain for inbox delivery.
3. **Enter OTP** → When the user clicks **Next** the email is validated and an OTP is sent; the UI then reveals fields for the OTP and new password. (When running outside production the frontend now shows the OTP directly if the server included it in its JSON response.)
4. **Reset Password** → User enters new password and confirms
5. **Success** → Password is reset, user can login with new password

## Configuration

### Backend (.env file)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
OTP_SECRET=your-secret-key
# the following are optional development helpers
FIXED_OTP=123456             # always return this OTP instead of random
STORE_PLAIN_OTP=true         # persist plaintext OTP in the database for debugging
```

**Note:** The system will use the FIXED_OTP value from .env file. Change it to any 6-digit number you want.

### Email Setup (Gmail)
1. Enable 2-Factor Authentication
2. Generate App Password
3. Use App Password in SMTP_PASS

## API Endpoints

### Request OTP
```
POST /api/forgot-password/request
Body: { "email": "user@example.com" }
Response: { "message": "OTP sent to your registered email", "otp": "123456" (dev only; returned only when DEBUG_OTPS=true and NODE_ENV!=production) }
```

### Reset Password
```
POST /api/forgot-password/reset
Body: { 
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "newpass123"
}
Response: { "message": "Password reset successful" }
```

## Features

- ✅ Email verification
- ✅ Fixed 6-digit OTP from .env file (FIXED_OTP=123456)
- ✅ OTP expires in 10 minutes
- ✅ Secure OTP hashing
- ✅ Password validation
- ✅ Resend OTP option
- ✅ Case-insensitive email matching and improved logging to diagnose issues where emails appear to always go to the SMTP user rather than the requested address
- ✅ Real-time status messages
- ✅ Email sending via SMTP
- ✅ Development mode shows OTP in response when DEBUG_OTPS=true (otherwise the UI remains clean) and the UI can display it if desired for testing
- ⚠️ Gmail→Gmail delivery may land in spam; mark as not‑spam or switch to a dedicated SMTP service/domain for reliable inbox placement.  

## Security

- OTPs are hashed before storage
- OTPs expire after 10 minutes
- Passwords are hashed with bcrypt
- Email validation required
- Minimum password length: 6 characters

## Testing

1. Start backend: `cd backend && npm start`
2. Start frontend: `npm run dev`
3. Click "Forgot Password" on login page
4. Enter registered email
5. Check email for OTP (or use dev OTP from console)
6. Enter OTP and new password
7. Login with new password
