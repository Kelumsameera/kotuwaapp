// Test-only settings, loaded before any app code (see "setupFiles" in package.json).
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://placeholder-replaced-by-memory-server';
process.env.CLIENT_URL = 'http://localhost:3001';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-chars-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-different-and-32-chars';
process.env.SMTP_HOST = '';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
