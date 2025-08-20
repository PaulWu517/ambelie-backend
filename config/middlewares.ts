export default [
  'strapi::logger',
  'global::error-handler', // 自定义错误处理中间件
  'strapi::errors',
  'global::database-check', // 数据库连接检查中间件
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          // 允许从腾讯云 COS 域名加载图片/媒体资源
          'img-src': ["'self'", 'data:', 'blob:', 'https://*.myqcloud.com', 'https://*.myqcloudimg.com'],
          'media-src': ["'self'", 'data:', 'blob:', 'https://*.myqcloud.com', 'https://*.myqcloudimg.com'],
          // 本地开发时允许 http 连接
          'connect-src': ["'self'", 'https:', 'http:'],
          // 关闭自动把 http 升级为 https，避免本地开发报错
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'https://ambelie-next-app-1-1.vercel.app',
        'https://www.ambelie.com',
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
        'stripe-signature',
        'Cache-Control',
        'Pragma'
      ],
      exposedHeaders: ['Content-Range', 'X-Content-Range'],
      maxAge: 86400, // 24 hours
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
