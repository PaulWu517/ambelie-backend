"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = [
    'strapi::logger',
    'global::error-handler', // 自定义错误处理中间件
    'strapi::errors',
    'global::database-check', // 数据库连接检查中间件
    'strapi::security',
    {
        name: 'strapi::cors',
        config: {
            origin: [
                process.env.FRONTEND_URL || 'http://localhost:3000',
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
