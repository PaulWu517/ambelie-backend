"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = () => ({
    upload: {
        config: {
            // 使用Railway Volume进行持久化存储
            // Railway会将项目部署到 /app，所以 ./public/uploads 实际是 /app/public/uploads
            provider: 'local',
            providerOptions: {
                localServer: {
                    maxage: 300000
                },
            },
            actionOptions: {
                upload: {},
                uploadStream: {},
                delete: {},
            },
            sizeLimit: 200 * 1024 * 1024, // 200MB
            breakpoints: {
                xlarge: 1920,
                large: 1000,
                medium: 750,
                small: 500,
                xsmall: 64
            },
        },
    },
    'users-permissions': {
        config: {
            jwt: {
                expiresIn: '7d',
            },
            ratelimit: {
                interval: 60000,
                max: 10,
            },
        },
        enabled: true,
    },
});
