"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ({ env }) => ({
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    // 只在生产环境设置PUBLIC_URL，本地开发时不设置避免URL拼接问题
    url: env('NODE_ENV') === 'production' ? env('PUBLIC_URL', 'https://ambelie-backend-production.up.railway.app') : undefined,
    app: {
        keys: env.array('APP_KEYS'),
    },
    webhooks: {
        populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
    },
    cron: {
        enabled: true,
    },
});
