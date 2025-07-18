export default ({ env }) => ({
  origin: [
    env('FRONTEND_URL', 'http://localhost:3000'),
    'https://ambelie-next-app-1-1.vercel.app',
    'https://*.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  headers: [
    'Content-Type',
    'Authorization',
    'Origin',
    'Accept',
    'X-Requested-With',
    'stripe-signature'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours
});