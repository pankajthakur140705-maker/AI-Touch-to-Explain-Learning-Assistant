/**
 * Mock Authentication Middleware
 * 
 * For demo purposes, accepts a hardcoded token "demo-user-token"
 * and maps it to userId "demo-user".
 * 
 * In production, this would verify JWT tokens against a real auth provider.
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

const DEMO_TOKENS = {
  'demo-user-token': { userId: 'demo-user', name: 'Demo User', email: 'demo@example.com' },
  'demo-user-2-token': { userId: 'demo-user-2', name: 'Jane Doe', email: 'jane@example.com' },
};

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please provide an authentication token in the Authorization header.',
    });
  }

  const token = authHeader.replace('Bearer ', '');

  if (!token || token.trim() === '') {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'The provided authentication token is empty or malformed.',
    });
  }

  // Simulate expired token check
  if (token === 'expired-token') {
    return res.status(401).json({
      error: 'Token expired',
      message: 'Your authentication token has expired. Please log in again.',
    });
  }

  const user = DEMO_TOKENS[token];

  if (!user) {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'The provided authentication token is not valid.',
    });
  }

  // Attach user info to request
  req.user = { ...user };
  next();
}

/**
 * Data isolation middleware — ensures users can only access their own data
 * Validates: Requirements 3.5, 3.6
 */
function dataIsolation(req, res, next) {
  // If a userId param is provided in query/body, verify it matches the auth user
  const requestedUserId = req.query.userId || req.body?.userId;

  if (requestedUserId && requestedUserId !== req.user.userId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to access this data.',
    });
  }

  next();
}

module.exports = { authMiddleware, dataIsolation };
