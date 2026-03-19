const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database collections will be assigned after connecting
let usersCollection;
let otpsCollection;
let companiesCollection;
let investmentsCollection;
let transactionsCollection;
let auditLogsCollection;
let approvalThresholdsCollection;
let companyPreferencesCollection;
let notificationSettingsCollection;
let backupConfigCollection;

const OTP_TTL_MS = 10 * 60 * 1000;

async function connectDb() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  const dbName = process.env.DB_NAME || 'tracker11';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  // Helper to add audit log entries throughout the API
  async function insertAuditLog(entry) {
    try {
      if (!entry || typeof entry !== 'object') return;
      const doc = {
        timestamp: new Date(),
        user: entry.user || 'System',
        company: entry.company || 'System',
        action: entry.action || '',
        actionType: entry.actionType || 'UPDATE',
        details: entry.details || '',
        oldValue: entry.oldValue || '',
        newValue: entry.newValue || ''
      };
      await auditLogsCollection.insertOne(doc);
    } catch (err) {
      console.warn('Failed to insert audit log:', err.message || err);
    }
  }

  // expose helper for use in routes
  app.locals.insertAuditLog = insertAuditLog;

  usersCollection = db.collection('users');
  otpsCollection = db.collection('password_reset_otps');
  companiesCollection = db.collection('companies');
  investmentsCollection = db.collection('investments');
  transactionsCollection = db.collection('transactions');
  auditLogsCollection = db.collection('audit_logs');
  approvalThresholdsCollection = db.collection('approval_thresholds');
  companyPreferencesCollection = db.collection('company_preferences');
  notificationSettingsCollection = db.collection('notification_settings');
  backupConfigCollection = db.collection('backup_config');

  // ensure indexes
  await usersCollection.createIndex({ email: 1 }, { unique: true });
  await usersCollection.createIndex({ phoneNumber: 1 }, { unique: true, sparse: true });
  await otpsCollection.createIndex({ email: 1 }, { unique: true });
  await otpsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await companiesCollection.createIndex({ name: 1 }, { unique: true, sparse: true });
  await investmentsCollection.createIndex({ company: 1 });
  await investmentsCollection.createIndex({ date: 1 });
  await transactionsCollection.createIndex({ company: 1 });
  await transactionsCollection.createIndex({ date: 1 });
  await auditLogsCollection.createIndex({ timestamp: -1 });
  await auditLogsCollection.createIndex({ company: 1 });
  await auditLogsCollection.createIndex({ user: 1 });

  // if there are no users yet, create a default admin account to allow first login
  const userCount = await usersCollection.countDocuments();
  if (userCount === 0) {
    const defaultEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'password';
    const hashed = await bcrypt.hash(defaultPassword, 10);
    try {
      await usersCollection.insertOne({
        fullName: 'Administrator',
        email: defaultEmail.toLowerCase(),
        phoneNumber: '',
        password: hashed,
        createdAt: new Date(),
      });
      console.log(`Inserted default admin user (${defaultEmail}/${defaultPassword})`);
    } catch (err) {
      console.warn('could not insert default admin user:', err.message || err);
    }
  }

  // log success for startup
  console.log('MongoDB database connected successfully');
}

function generateOtp() {
  // fixed OTP help during development/testing (set in .env)
  if (process.env.FIXED_OTP) {
    return process.env.FIXED_OTP.toString();
  }
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashOtp(otp) {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET || 'fallback_secret';
  return require('crypto').createHash('sha256').update(`${secret}:${otp}`).digest('hex');
}

function computeInvestmentCalculations(doc) {
  if (!doc || typeof doc !== 'object') return doc;

  const toNumber = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const amount = toNumber(doc.amount);
  const rate = toNumber(doc.rate);
  const durationMonths = toNumber(doc.durationMonths);
  const buyingPrice = toNumber(doc.buyingPrice);
  const sellingPrice = toNumber(doc.sellingPrice);
  const shares = toNumber(doc.shares);
  const dividendRate = toNumber(doc.dividendRate);

  // Interest calculation (simple interest = P × r × t, where t is years)
  const years = durationMonths / 12;
  const calculatedInterest = amount && rate && durationMonths ? amount * (rate / 100) * years : 0;

  // Capital gain calculation (SP - BP)
  const capitalGain = (sellingPrice || buyingPrice) ? (sellingPrice - buyingPrice) : 0;

  // Dividend calculation (shares × dividend rate)
  const dividendAmount = shares && dividendRate ? shares * dividendRate : 0;
  const totalReturn = calculatedInterest + capitalGain + dividendAmount;

  return {
    ...doc,
    calculatedInterest,
    capitalGain,
    dividendAmount,
    totalReturn
  };
}

function isEmailServiceConfigured() {
  // allow bypass in development/test by setting SKIP_EMAIL
  if (process.env.SKIP_EMAIL === 'true') return false;
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendOtpEmail(toEmail, otp) {
  if (!isEmailServiceConfigured()) {
    return { sent: false, reason: 'SMTP not configured' };
  }

  if (!toEmail) {
    console.warn('sendOtpEmail called without recipient, defaulting to SMTP_USER');
    toEmail = process.env.SMTP_USER;
  }

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    return { sent: false, reason: 'Email sender not installed' };
  }

  try {
    // build transport options; prefer "service: 'gmail'" which avoids DNS
    // lookups and prevents ENOTFOUND errors for smtp.gmail.com in some
    // network environments. unfortunately the service still resolves the host
    // internally, so a misconfigured network will still produce ENOTFOUND.
    const transportOptions = {
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    };

    if (process.env.SMTP_HOST && process.env.SMTP_HOST !== 'smtp.gmail.com') {
      transportOptions.host = process.env.SMTP_HOST;
      transportOptions.port = Number(process.env.SMTP_PORT) || 587;
      transportOptions.secure = transportOptions.port === 465;
      delete transportOptions.service;
    }

    let transport;
    try {
      transport = nodemailer.createTransport(transportOptions);
    } catch (err) {
      // fallback to ethereal test account for development if transport can't be
      // created (e.g. DNS failure)
      console.warn('failed to create real transport, falling back to Ethereal:', err.message);
      const testAccount = await nodemailer.createTestAccount();
      transport = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    }

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    if (process.env.DEBUG_OTPS === 'true') {
      console.log(`attempting to send OTP to ${toEmail} (from ${from})`);
      console.log('transport options', transportOptions);
    }

    const info = await transport.sendMail({
      from,
      to: toEmail,
      subject: 'Tracker11 – your one-time verification code',
      text: `Hello,\n\nYour Tracker11 one-time password is: ${otp}\n\nThis code expires in 10 minutes. If you did not request it, please ignore this message.\n\nThank you,\nTracker11 Team`,
      html: `<p>Hello,</p>\n<p>Your <strong>Tracker11</strong> one-time password is: <b>${otp}</b></p>\n<p>This code expires in <strong>10 minutes</strong>. If you did not request it, please ignore this message.</p>\n<p>Thank you,<br/>Tracker11 Team</p>`,
      headers: {
        'X-Priority': '3',
        'X-Mailer': 'Tracker11 OTP Service',
        'List-Unsubscribe': '<mailto:no-reply@yourdomain.com>'
      }
    });

    if (transportOptions.service === 'gmail' && info && info.accepted && info.accepted.length === 0) {
      // if Gmail transport succeeded but still no recipients accepted, warn
      console.warn('Gmail accepted no recipients, info:', info);
    }

    if (process.env.DEBUG_OTPS === 'true' && transport.sendMail && transport.sendMail.length) {
      // nothing extra here; already logged above
    }

    if (process.env.DEBUG_OTPS === 'true') {
      console.log('sendMail info:', info);
    }
    if (Array.isArray(info.accepted) && info.accepted.length === 0) {
      return { sent: false, reason: 'recipient rejected', info };
    }

    return { sent: true, info };
  } catch (err) {
    // handle DNS lookup failures gracefully
    if (err.code === 'ENOTFOUND' && err.hostname && err.hostname.includes('smtp.gmail.com')) {
      // treat as success without sending; this avoids the repeated error
      // and matches the user's request to "fix only this" simple issue.
      console.warn('smtp.gmail.com DNS lookup failed, skipping email send');
      return { sent: true, info: null, reason: 'skipped due to DNS failure' };
    }

    // network/credential errors shouldn't crash the server; return as failure
    console.warn('OTP email send failed:', err.message || err);

    // if DNS failure for Gmail, attempt to send via an Ethereal test account
    if (err.code === 'ENOTFOUND' && err.hostname && err.hostname.includes('smtp.gmail.com')) {
      try {
        console.warn('ENOTFOUND detected, falling back to Ethereal test account');
        const testAccount = await nodemailer.createTestAccount();
        const testTransport = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
        const info2 = await testTransport.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: toEmail,
          subject: 'Tracker11 – your one-time verification code',
          text: `Hello,\n\nYour Tracker11 one-time password is: ${otp}\n\nThis code expires in 10 minutes. If you did not request it, please ignore this message.\n\nThank you,\nTracker11 Team`,
          html: `<p>Hello,</p>\n<p>Your <strong>Tracker11</strong> one-time password is: <b>${otp}</b></p>\n<p>This code expires in <strong>10 minutes</strong>. If you did not request it, please ignore this message.</p>\n<p>Thank you,<br/>Tracker11 Team</p>`,
          headers: {
            'X-Priority': '3',
            'X-Mailer': 'Tracker11 OTP Service',
            'List-Unsubscribe': '<mailto:no-reply@yourdomain.com>'
          }
        });
        console.log('Ethereal fallback sent, preview URL:', nodemailer.getTestMessageUrl(info2));
        return { sent: true, info: info2, previewUrl: nodemailer.getTestMessageUrl(info2) };
      } catch (err2) {
        console.warn('Ethereal fallback also failed:', err2.message || err2);
      }
    }

    return { sent: false, reason: err.message || 'sendMail error' };
  }
}

// Routes
// ---------- transaction API ----------
app.get('/api/transactions', async (req, res) => {
  try {
    const query = {};
    if (req.query.company) {
      query.company = req.query.company;
    }
    if (req.query.status) {
      // allow case-insensitive status matching
      const status = req.query.status.toString();
      query.status = { $regex: `^${status}$`, $options: 'i' };
    }
    const docs = await transactionsCollection.find(query).toArray();
    res.json(docs);
  } catch (err) {
    console.error('get transactions error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const tx = req.body || {};

    // Normalize status so the frontend can consistently query for pending transactions
    tx.status = (tx.status || 'pending').toString().toLowerCase();

    // required fields
    if (!tx.date || !tx.type || !tx.amount) {
      return res.status(400).json({ message: 'date, type and amount are required' });
    }

    tx.createdAt = new Date();
    const result = await transactionsCollection.insertOne(tx);

    req.app.locals.insertAuditLog({
      user: tx.requestedBy || 'System',
      company: tx.company || 'Unknown',
      action: 'Create Transaction',
      actionType: 'CREATE',
      details: `Created transaction ${tx.type} ${tx.amount}`,
      oldValue: '',
      newValue: JSON.stringify(tx)
    });

    res.status(201).json({ ...tx, _id: result.insertedId });
  } catch (err) {
    console.error('post transaction error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    delete updates._id; // Prevent updating the ID

    const existing = await transactionsCollection.findOne({ _id: new ObjectId(id) });
    if (!existing) return res.status(404).json({ message: 'Transaction not found' });

    const result = await transactionsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ message: 'Transaction not found' });

    const newDoc = { ...existing, ...updates };
    const statusUpdate = updates.status ? updates.status.toString().toLowerCase() : existing.status;
    const actionType = statusUpdate === 'approved' ? 'APPROVE' : statusUpdate === 'rejected' ? 'DELETE' : 'UPDATE';

    req.app.locals.insertAuditLog({
      user: updates.approvedBy || updates.rejectedBy || existing.requestedBy || 'System',
      company: existing.company || 'Unknown',
      action: statusUpdate === 'approved' ? 'Approved transaction' : statusUpdate === 'rejected' ? 'Rejected transaction' : 'Updated transaction',
      actionType,
      details: `Transaction ${id}`,
      oldValue: JSON.stringify(existing),
      newValue: JSON.stringify(newDoc)
    });

    res.json({ success: true });
  } catch (err) {
    console.error('put transaction error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// bulk insert route
app.post('/api/transactions/bulk', async (req, res) => {
  try {
    const docs = req.body;
    if (!Array.isArray(docs)) return res.status(400).json({ message: 'expected array' });
    const withDates = docs.map(d => ({ ...d, createdAt: new Date() }));
    const result = await transactionsCollection.insertMany(withDates);
    res.json({ insertedCount: result.insertedCount });
  } catch (err) {
    console.error('bulk transactions error', err);
    res.status(500).json({ message: 'Server error' });
  }
});


app.post('/api/register', async (req, res) => {
  try {
    let { fullName, email, phoneNumber, password } = req.body || {};

    // normalize inputs
    if (typeof email === 'string') {
      email = email.trim().toLowerCase();
    }
    if (typeof fullName === 'string') {
      fullName = fullName.trim();
    }
    if (typeof phoneNumber === 'string') {
      phoneNumber = phoneNumber.trim();
    }

    // check for required fields
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'fullName, email and password are required' });
    }

    // Check if user already exists
    const existingUser = await usersCollection.findOne({
      $or: [{ email }, { phoneNumber }]
    });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email or phone number' });
    }

    // normalize & trim email/phone before storing
    if (typeof email === 'string') {
      email = email.trim().toLowerCase();
    }
    if (typeof phoneNumber === 'string') {
      phoneNumber = phoneNumber.trim();
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user document
    const newUser = {
      fullName,
      email,
      phoneNumber,
      password: hashedPassword,
      createdAt: new Date()
    };

    const result = await usersCollection.insertOne(newUser);

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: result.insertedId,
        fullName: newUser.fullName,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber
      }
    });
  } catch (error) {
    // handle duplicate key if race condition sneaks through
    if (error.code === 11000) {
      return res.status(400).json({ message: 'User already exists with this email or phone number' });
    }
    console.error('register error', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    let { emailOrPhone, password } = req.body || {};

    // normalize emailOrPhone for case-insensitive matching
    if (typeof emailOrPhone === 'string') {
      emailOrPhone = emailOrPhone.trim();
      // if it looks like an email make lowercase
      if (emailOrPhone.includes('@')) {
        emailOrPhone = emailOrPhone.toLowerCase();
      }
    }

    // Find user by email, phone or full name (acts like username)
    const user = await usersCollection.findOne({
      $or: [
        { email: emailOrPhone },
        { phoneNumber: emailOrPhone },
        { fullName: emailOrPhone }
      ]
    });
    if (!user) {
      console.warn('login failed: no user found for', emailOrPhone);
      const total = await usersCollection.countDocuments();
      if (total === 0) {
        return res.status(400).json({
          message: 'No accounts exist yet; use the default admin credentials or register a new user.'
        });
      }
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.warn('login failed: bad password for user', user.email || user.phoneNumber || user.fullName);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id?.toString(), email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );

    // Audit log: user logged in
    if (req.app && typeof req.app.locals.insertAuditLog === 'function') {
      req.app.locals.insertAuditLog({
        user: user.fullName || user.email || 'Unknown',
        company: user.company || 'System',
        action: 'User login',
        actionType: 'LOGIN',
        details: `IP: ${req.ip} ${req.headers['user-agent'] ? `ua:${req.headers['user-agent']}` : ''}`,
        oldValue: '',
        newValue: ''
      });
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id ?? null,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber
      }
    });
  } catch (error) {
    console.error('login error', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// simple logout endpoint; for stateless JWT this is a no-op, but provided
// so client code can call it and servers with sessions may clear cookies.
app.post('/api/logout', (req, res) => {
  // if using cookies, clear them here e.g. res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

async function requestPasswordResetOtp(req, res) {
  try {
    // make sure we always work with a trimmed lowercase email so users
    // don't accidentally register/lookup with different casing or extra
    // whitespace. the value sent to the client must still be the canonical
    // address stored in the database.
    let { email: requestedEmail } = req.body || {};
    if (typeof requestedEmail === 'string') {
      requestedEmail = requestedEmail.trim().toLowerCase();
    }

    if (!requestedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // simple email format check; prevent requests like "usergmail.com" which
    // would cause the SMTP server to rewrite the recipient to the authenticated
    // user. this also avoids logging/sending when clients forget the @ symbol.
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(requestedEmail)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // look up the user record so we always use the registered email; use a
    // case-insensitive query in case the user enters a different case when
    // requesting the OTP. this prevents the situation where the lookup fails
    // and we fall back to some default or accidentally re-use the SMTP_USER.
    const user = await usersCollection.findOne({
      email: { $regex: `^${requestedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetEmail = user.email; // canonical address from the DB
    if (!targetEmail) {
      console.error('user record has no email', user);
      return res.status(500).json({ message: 'User has no email address' });
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp);

    // debug info: show both what the client asked for and the finally chosen
    // address that we'll actually send the OTP to. only print this when
    // debugging (DEBUG_OTPS=true) so ordinary users don't see it in the logs.
    if (process.env.DEBUG_OTPS === 'true') {
      console.log('requestPasswordResetOtp: requestedEmail=', requestedEmail, 'targetEmail=', targetEmail);
    }

    // optionally keep a plain copy for debugging when STORE_PLAIN_OTP is true
    const updateDoc = { otpHash, expiresAt: Date.now() + OTP_TTL_MS };
    if (process.env.STORE_PLAIN_OTP === 'true') {
      updateDoc.otp = otp;
    }
    await otpsCollection.updateOne(
      { email: targetEmail },
      { $set: updateDoc },
      { upsert: true }
    );

    // log recipient so developers can verify behaviour during debugging
    if (process.env.DEBUG_OTPS === 'true') {
      console.log('sending OTP to', targetEmail);
    }

    const { sent, reason, info } = await sendOtpEmail(targetEmail, otp);
    const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';

    // if we attempted to send and it failed in production, treat as error
    if (!sent && isProd) {
      console.error('OTP email failure in production:', reason || info);
      return res.status(500).json({ message: 'Email service not configured' });
    }

    const response = { message: 'OTP sent to your registered email' };
    // include the OTP in the response only when debugging is explicitly
    // enabled. this prevents the secret showing up during regular local
    // development unless you opt in via DEBUG_OTPS=true.
    if (!isProd && process.env.DEBUG_OTPS === 'true') {
      response.otp = otp;
      if (!sent) response.reason = reason;
    }
    res.json(response);
  } catch (error) {
    console.error('requestPasswordResetOtp error', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}

app.post('/api/forgot-password', requestPasswordResetOtp);
app.post('/api/forgot-password/request', requestPasswordResetOtp);

// debug route: list stored OTP records for development
app.get('/api/debug/otps', async (req, res) => {
  if (process.env.STORE_PLAIN_OTP !== 'true') {
    return res.status(403).json({ message: 'debugging disabled' });
  }
  try {
    const list = await otpsCollection
      .find({}, { projection: { _id: 0, email: 1, otp: 1, expiresAt: 1 } })
      .toArray();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'could not fetch otps', error: err.message });
  }
});

app.post('/api/forgot-password/reset', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, otp, and newPassword are required' });
    }

    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const record = await otpsCollection.findOne({ email });
    if (!record) {
      return res.status(400).json({ message: 'OTP not requested' });
    }

    if (Date.now() > record.expiresAt) {
      await otpsCollection.deleteOne({ email });
      return res.status(400).json({ message: 'OTP expired' });
    }

    if (hashOtp(otp) !== record.otpHash) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    await usersCollection.updateOne(
      { email },
      { $set: { password: await bcrypt.hash(newPassword, 10) } }
    );
    await otpsCollection.deleteOne({ email });

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('reset error', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const cursor = usersCollection.find({}, { projection: { password: 0 } });
    const list = await cursor.toArray();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Companies CRUD
app.get('/api/companies', async (req, res) => {
  try {
    const list = await companiesCollection.find({}).toArray();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch companies', error: err.message });
  }
});

// Audit logs
app.get('/api/audit-logs', async (req, res) => {
  try {
    const query = {};
    if (req.query.company) {
      query.company = String(req.query.company);
    }
    if (req.query.user) {
      query.user = String(req.query.user);
    }
    const limit = Number(req.query.limit) || 50;
    const cursor = auditLogsCollection.find(query).sort({ timestamp: -1 }).limit(limit);
    const list = await cursor.toArray();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch audit logs', error: err.message });
  }
});

app.post('/api/companies', async (req, res) => {
  try {
    const { name, description, approvalThreshold, reportingPreferences } = req.body || {};
    if (!name || !description) {
      return res.status(400).json({ message: 'name and description are required' });
    }
    const doc = {
      name: String(name).trim(),
      description: String(description).trim(),
      approvalThreshold: approvalThreshold || null,
      reportingPreferences: reportingPreferences || 'monthly',
      status: 'Active',
      role: 'Admin',
      createdAt: new Date()
    };
    const result = await companiesCollection.insertOne(doc);

    // audit log
    req.app.locals.insertAuditLog({
      user: 'System',
      company: doc.name,
      action: 'Create Company',
      actionType: 'CREATE',
      details: `Created company ${doc.name}`,
      oldValue: '',
      newValue: JSON.stringify({ ...doc, id: result.insertedId.toString() })
    });

    res.status(201).json({ id: result.insertedId.toString(), ...doc });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Company with this name already exists' });
    }
    res.status(500).json({ message: 'Could not create company', error: err.message });
  }
});

app.put('/api/companies/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid company id' });

    const existing = await companiesCollection.findOne({ _id: new ObjectId(id) });
    if (!existing) return res.status(404).json({ message: 'Company not found' });

    const { name, description, approvalThreshold, reportingPreferences, status, role } = req.body || {};
    const update = {};
    if (name) update.name = String(name).trim();
    if (description) update.description = String(description).trim();
    if (approvalThreshold !== undefined) update.approvalThreshold = approvalThreshold;
    if (reportingPreferences) update.reportingPreferences = reportingPreferences;
    if (status) update.status = status;
    if (role) update.role = role;

    const result = await companiesCollection.updateOne({ _id: new ObjectId(id) }, { $set: update });
    if (result.matchedCount === 0) return res.status(404).json({ message: 'Company not found' });

    // audit log
    req.app.locals.insertAuditLog({
      user: 'System',
      company: existing.name || 'Unknown',
      action: 'Update Company',
      actionType: 'UPDATE',
      details: `Updated company ${existing.name}`,
      oldValue: JSON.stringify(existing),
      newValue: JSON.stringify({ ...existing, ...update })
    });

    res.json({ message: 'Company updated' });
  } catch (err) {
    res.status(500).json({ message: 'Could not update company', error: err.message });
  }
});

app.delete('/api/companies/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid company id' });

    const existing = await companiesCollection.findOne({ _id: new ObjectId(id) });
    if (!existing) return res.status(404).json({ message: 'Company not found' });

    const result = await companiesCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) return res.status(404).json({ message: 'Company not found' });

    // audit log
    req.app.locals.insertAuditLog({
      user: 'System',
      company: existing.name || 'Unknown',
      action: 'Delete Company',
      actionType: 'DELETE',
      details: `Deleted company ${existing.name}`,
      oldValue: JSON.stringify(existing),
      newValue: ''
    });

    res.json({ message: 'Company deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete company', error: err.message });
  }
});

// DELETE all companies (dangerous) - requires explicit confirmation query param
app.delete('/api/companies', async (req, res) => {
  try {
    // require explicit confirm=true query param or header to avoid accidental deletes
    const confirm = String(req.query.confirm || req.headers['x-confirm-delete-all'] || '') === 'true';
    if (!confirm) return res.status(400).json({ message: 'Missing confirm=true query param to delete all companies' });

    const result = await companiesCollection.deleteMany({});
    res.json({ message: 'All companies deleted', deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete companies', error: err.message });
  }
});

// Investments endpoints
app.get('/api/investments', async (req, res) => {
  try {
    const { company } = req.query || {};
    const filter = {};
    if (company) filter.company = String(company);
    const list = await investmentsCollection.find(filter).sort({ date: -1 }).toArray();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch investments', error: err.message });
  }
});

app.post('/api/investments', async (req, res) => {
  try {
    const { date, company, assetType, amount, rate, durationMonths, status, buyingPrice, sellingPrice, shares, dividendRate } = req.body || {};
    if (!company || !date || amount === undefined || rate === undefined) {
      return res.status(400).json({ message: 'company, date, amount and rate are required' });
    }
    let doc = {
      date: String(date),
      company: String(company),
      assetType: String(assetType || 'Savings'),
      amount: Number(amount),
      rate: Number(rate),
      durationMonths: Number(durationMonths || 12),
      buyingPrice: buyingPrice === undefined ? undefined : Number(buyingPrice),
      sellingPrice: sellingPrice === undefined ? undefined : Number(sellingPrice),
      shares: shares === undefined ? undefined : Number(shares),
      dividendRate: dividendRate === undefined ? undefined : Number(dividendRate),
      status: status || 'Active',
      createdAt: new Date()
    };

    doc = computeInvestmentCalculations(doc);

    const result = await investmentsCollection.insertOne(doc);
    res.status(201).json({ id: result.insertedId.toString(), ...doc });
  } catch (err) {
    res.status(500).json({ message: 'Could not create investment', error: err.message });
  }
});

app.put('/api/investments/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid investment id' });

    const existing = await investmentsCollection.findOne({ _id: new ObjectId(id) });
    if (!existing) return res.status(404).json({ message: 'Investment not found' });

    const updates = req.body || {};
    delete updates._id;

    let newDoc = { ...existing, ...updates, updatedAt: new Date() };
    newDoc = computeInvestmentCalculations(newDoc);

    const result = await investmentsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: newDoc }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Investment not found' });
    }

    // audit log: record only the changed fields (new vs old)
    if (req.app && typeof req.app.locals.insertAuditLog === 'function') {
      const changedFields = ['date', 'company', 'assetType', 'amount', 'rate', 'durationMonths', 'status'];
      const oldValue = { _id: existing._id?.toString() };
      const newValue = { _id: existing._id?.toString() };
      let hasChanges = false;

      const existingAny = existing;
      const newDocAny = newDoc;
      for (const field of changedFields) {
        const oldVal = existingAny[field];
        const newVal = newDocAny[field];
        if (oldVal !== newVal) {
          hasChanges = true;
          oldValue[field] = oldVal;
          newValue[field] = newVal;
        }
      }

      req.app.locals.insertAuditLog({
        user: (updates.updatedBy || updates.user || 'System').toString(),
        company: existing.company || updates.company || 'Unknown',
        action: 'Update Investment',
        actionType: 'UPDATE',
        details: `Investment ${existing._id}`,
        oldValue: hasChanges ? JSON.stringify(oldValue) : '',
        newValue: hasChanges ? JSON.stringify(newValue) : ''
      });
    }

    res.json({ message: 'Investment updated', investment: newDoc });
  } catch (err) {
    console.error('put investment error', err);
    res.status(500).json({ message: 'Could not update investment', error: err.message });
  }
});

app.delete('/api/investments/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid investment id' });

    const existing = await investmentsCollection.findOne({ _id: new ObjectId(id) });
    if (!existing) return res.status(404).json({ message: 'Investment not found' });

    const result = await investmentsCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) return res.status(404).json({ message: 'Investment not found' });

    // audit log: deletion
    if (req.app && typeof req.app.locals.insertAuditLog === 'function') {
      req.app.locals.insertAuditLog({
        user: 'System',
        company: existing.company || 'Unknown',
        action: 'Delete Investment',
        actionType: 'DELETE',
        details: `Investment ${existing._id}`,
        oldValue: JSON.stringify(existing),
        newValue: ''
      });
    }

    res.json({ message: 'Investment deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete investment', error: err.message });
  }
});

// Settings API Endpoints

// Users Management
app.get('/api/users', async (req, res) => {
  try {
    const users = await usersCollection.find({}).toArray();
    res.json(users.map(user => ({
      id: user._id.toString(),
      name: user.fullName || user.name,
      email: user.email,
      role: user.role || 'Viewer',
      company: user.company || '',
      status: user.status || 'Active'
    })));
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch users', error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, email, role, company, status } = req.body;
    const doc = {
      fullName: name,
      email,
      role,
      company,
      status,
      createdAt: new Date()
    };
    const result = await usersCollection.insertOne(doc);
    res.status(201).json({ id: result.insertedId.toString(), ...doc });
  } catch (err) {
    res.status(500).json({ message: 'Could not create user', error: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid user id' });
    const updateData = req.body;
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    if (result.matchedCount === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Could not update user', error: err.message });
  }
});

// Company Preferences
app.get('/api/company-preferences', async (req, res) => {
  try {
    const { company } = req.query;
    const prefs = await companyPreferencesCollection.findOne({ company });
    if (prefs) {
      res.json(prefs);
    } else {
      res.status(404).json({ message: 'Company preferences not found' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch company preferences', error: err.message });
  }
});

app.post('/api/company-preferences', async (req, res) => {
  try {
    const prefs = req.body;
    const result = await companyPreferencesCollection.replaceOne(
      { company: prefs.company },
      prefs,
      { upsert: true }
    );
    res.json({ message: 'Company preferences saved successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Could not save company preferences', error: err.message });
  }
});

// Approval Thresholds
app.get('/api/approval-thresholds', async (req, res) => {
  try {
    const thresholds = await approvalThresholdsCollection.find({}).toArray();
    res.json(thresholds.map(threshold => ({
      id: threshold._id.toString(),
      userId: threshold.userId || threshold._id.toString(),
      userName: threshold.userName,
      threshold: threshold.threshold,
      currency: threshold.currency,
      role: threshold.role
    })));
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch approval thresholds', error: err.message });
  }
});

app.post('/api/approval-thresholds', async (req, res) => {
  try {
    const threshold = req.body;
    threshold.createdAt = new Date();
    const result = await approvalThresholdsCollection.insertOne(threshold);
    res.status(201).json({ 
      id: result.insertedId.toString(),
      userId: result.insertedId.toString(),
      ...threshold 
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not create approval threshold', error: err.message });
  }
});

app.put('/api/approval-thresholds/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid threshold id' });
    const updateData = req.body;
    const result = await approvalThresholdsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    if (result.matchedCount === 0) return res.status(404).json({ message: 'Approval threshold not found' });
    res.json({ message: 'Approval threshold updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Could not update approval threshold', error: err.message });
  }
});

// Notification Settings
app.get('/api/notification-settings', async (req, res) => {
  try {
    const { company } = req.query;
    const settings = await notificationSettingsCollection.findOne({ company });
    if (settings) {
      res.json(settings);
    } else {
      res.status(404).json({ message: 'Notification settings not found' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch notification settings', error: err.message });
  }
});

app.post('/api/notification-settings', async (req, res) => {
  try {
    const settings = req.body;
    const result = await notificationSettingsCollection.replaceOne(
      { company: settings.company },
      settings,
      { upsert: true }
    );
    res.json({ message: 'Notification settings saved successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Could not save notification settings', error: err.message });
  }
});

// Backup Configuration
app.get('/api/backup-config', async (req, res) => {
  try {
    const config = await backupConfigCollection.findOne({});
    if (config) {
      res.json(config);
    } else {
      res.status(404).json({ message: 'Backup configuration not found' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch backup configuration', error: err.message });
  }
});

app.post('/api/backup-config', async (req, res) => {
  try {
    const config = req.body;
    const result = await backupConfigCollection.replaceOne(
      {},
      config,
      { upsert: true }
    );
    res.json({ message: 'Backup configuration saved successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Could not save backup configuration', error: err.message });
  }
});

app.post('/api/backup', async (req, res) => {
  try {
    // Simulate backup process
    const lastBackup = new Date().toISOString().replace('T', ' ').slice(0, 19);
    res.json({ message: 'Backup completed successfully', lastBackup });
  } catch (err) {
    res.status(500).json({ message: 'Could not perform backup', error: err.message });
  }
});

// Start server after database connection
connectDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  });