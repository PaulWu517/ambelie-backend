export default [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': [
            "'self'", 
            'data:', 
            'blob:', 
            'market-assets.strapi.io',
            'https://ambelie-backend-production.up.railway.app',
            '*.railway.app',
            process.env.FRONTEND_URL || 'https://your-frontend-domain.vercel.app'
          ],
          'media-src': [
            "'self'", 
            'data:', 
            'blob:', 
            'https://ambelie-backend-production.up.railway.app',
            '*.railway.app',
            process.env.FRONTEND_URL || 'https://your-frontend-domain.vercel.app'
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL, 'http://localhost:3000'] : ['*'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      keepHeaderOnError: true,
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      parserOptions: {
        jsonLimit: '10mb',
        formLimit: '256mb',
        textLimit: '10mb',
        formidable: {
          maxFileSize: 200 * 1024 * 1024, // 200MB
        },
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
