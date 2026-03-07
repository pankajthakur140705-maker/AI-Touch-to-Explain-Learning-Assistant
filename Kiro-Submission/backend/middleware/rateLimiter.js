/**
 * Rate Limiter Middleware
 * 
 * Tracks request count per user per second and applies throttling.
 * Validates: Requirements 2.4, 2.5, 15.2
 * 
 * Limits:
 * - 100 requests/sec per user
 * - 10,000 requests/sec system-wide
 */

const userRequests = new Map(); // userId -> { count, windowStart }
let systemRequests = { count: 0, windowStart: Date.now() };

const USER_LIMIT = 100;       // requests per second per user
const SYSTEM_LIMIT = 10000;   // requests per second system-wide
const WINDOW_MS = 1000;       // 1 second window

function rateLimiter(req, res, next) {
  const now = Date.now();

  // System-wide rate limiting
  if (now - systemRequests.windowStart >= WINDOW_MS) {
    systemRequests = { count: 0, windowStart: now };
  }
  systemRequests.count++;

  if (systemRequests.count > SYSTEM_LIMIT) {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'The system is experiencing high traffic. Please try again shortly.',
    });
  }

  // Per-user rate limiting (only if user is authenticated)
  if (req.user) {
    const userId = req.user.userId;
    let userEntry = userRequests.get(userId);

    if (!userEntry || now - userEntry.windowStart >= WINDOW_MS) {
      userEntry = { count: 0, windowStart: now };
      userRequests.set(userId, userEntry);
    }

    userEntry.count++;

    if (userEntry.count > USER_LIMIT) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `You have exceeded the limit of ${USER_LIMIT} requests per second. Please slow down.`,
      });
    }
  }

  next();
}

module.exports = { rateLimiter };
