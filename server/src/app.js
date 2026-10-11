const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const env = require('./config/env');
const apiRoutes = require('./routes');
const sanitizeInput = require('./middleware/sanitizeInput');
const { csrfGuard } = require('./middleware/csrfGuard');
const { globalLimiter } = require('./middleware/rateLimiters');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// Builds the Express app with all security middleware and routes.
// Kept separate from server.js so tests can use the app without opening a port.
function createApp() {
  const app = express();

  // We run behind the Next.js proxy (and a host's proxy in production), so trust X-Forwarded-For.
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
      allowedHeaders: ['Content-Type', 'X-Requested-With'],
    })
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use(mongoSanitize()); // removes $ and . keys, blocking NoSQL injection
  app.use(hpp()); // blocks ?role=a&role=b parameter pollution
  app.use(sanitizeInput); // strips HTML from text (XSS)

  app.use('/api', globalLimiter, csrfGuard, apiRoutes);
  app.use('/api', notFoundHandler);

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
