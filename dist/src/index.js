"use strict";
// import type { Core } from '@strapi/strapi';
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * An asynchronous register function that runs before
     * your application is initialized.
     *
     * This gives you an opportunity to extend code.
     */
    register({ strapi }) {
        // 注册服务端自定义字段（与admin的 app.customFields.register 配套）
        // 名称需与admin端一致：global::word-count-textarea
        strapi.customFields.register({
            name: 'word-count-textarea',
            // 不指定 plugin，表示全局自定义字段，对应 schema 中的 "global::word-count-textarea"
            type: 'text',
            inputSize: {
                default: 12,
                isResizable: true,
            },
        });
    },
    /**
     * An asynchronous bootstrap function that runs before
     * your application gets started.
     *
     * This gives you an opportunity to set up your data model,
     * run jobs, or perform some special logic.
     */
    bootstrap({ strapi }) {
        // 订阅 upload 文件模型的生命周期日志，确保在所有环境都能看到（包括生产）
        strapi.db.lifecycles.subscribe({
            models: ['plugin::upload.file'],
            async afterCreate(event) {
                try {
                    const { result } = event;
                    const id = result === null || result === void 0 ? void 0 : result.id;
                    const url = result === null || result === void 0 ? void 0 : result.url;
                    const name = result === null || result === void 0 ? void 0 : result.name;
                    const mime = result === null || result === void 0 ? void 0 : result.mime;
                    const size = result === null || result === void 0 ? void 0 : result.size;
                    const formats = (result === null || result === void 0 ? void 0 : result.formats) || {};
                    const formatKeys = Object.keys(formats);
                    const formatUrls = Object.fromEntries(Object.entries(formats).map(([k, v]) => [k, v === null || v === void 0 ? void 0 : v.url]));
                    strapi.log.info(`Upload lifecycle afterCreate -> id:${id} name:${name} mime:${mime} size:${size}`);
                    strapi.log.info(`Upload lifecycle afterCreate -> url:${url} formats:${formatKeys.join(',') || 'none'}`);
                    strapi.log.info(`Upload lifecycle afterCreate -> format urls:${JSON.stringify(formatUrls)}`);
                }
                catch (err) {
                    strapi.log.error('Upload lifecycle afterCreate log error:', err);
                }
            },
            async afterUpdate(event) {
                try {
                    const { result } = event;
                    const id = result === null || result === void 0 ? void 0 : result.id;
                    const formats = (result === null || result === void 0 ? void 0 : result.formats) || {};
                    const formatKeys = Object.keys(formats);
                    const formatUrls = Object.fromEntries(Object.entries(formats).map(([k, v]) => [k, v === null || v === void 0 ? void 0 : v.url]));
                    strapi.log.info(`Upload lifecycle afterUpdate -> id:${id} formats:${formatKeys.join(',') || 'none'}`);
                    strapi.log.info(`Upload lifecycle afterUpdate -> format urls:${JSON.stringify(formatUrls)}`);
                }
                catch (err) {
                    strapi.log.error('Upload lifecycle afterUpdate log error:', err);
                }
            },
        });
        // 在服务器启动后添加原始的Stripe webhook处理器
        strapi.server.httpServer.on('listening', () => {
            strapi.log.info('添加Stripe webhook处理器');
            // 在现有中间件之前插入webhook处理器
            const koaApp = strapi.server.app;
            // 保存现有的中间件
            const existingMiddleware = koaApp.middleware.slice();
            // 清空现有中间件
            koaApp.middleware = [];
            // 添加我们的webhook处理器作为第一个中间件
            koaApp.use(async (ctx, next) => {
                // 只处理Stripe webhook路径
                if (ctx.path === '/api/payments/webhook' && ctx.method === 'POST') {
                    strapi.log.info('Webhook处理器：拦截Stripe webhook请求');
                    try {
                        // 检查stream是否可读
                        if (!ctx.req.readable) {
                            strapi.log.error('Webhook处理器：stream不可读');
                            ctx.status = 400;
                            ctx.body = { error: 'Request stream not readable' };
                            return;
                        }
                        // 读取原始body
                        const chunks = [];
                        for await (const chunk of ctx.req) {
                            chunks.push(chunk);
                        }
                        const rawBody = Buffer.concat(chunks);
                        const signature = ctx.request.headers['stripe-signature'];
                        strapi.log.info('Webhook处理器：读取body成功，长度:', rawBody.length);
                        strapi.log.info('Webhook处理器：签名存在:', !!signature);
                        if (!signature) {
                            strapi.log.error('Webhook处理器：缺少签名');
                            ctx.status = 400;
                            ctx.body = { error: '缺少Stripe签名' };
                            return;
                        }
                        // 验证签名
                        const { verifyWebhookSignature } = require('./services/stripe');
                        const event = await verifyWebhookSignature(rawBody, Array.isArray(signature) ? signature[0] : signature);
                        strapi.log.info('Webhook处理器：签名验证成功，事件类型:', event.type);
                        // 处理事件
                        const paymentController = strapi.controllers['api::payment.payment'];
                        switch (event.type) {
                            case 'checkout.session.completed':
                                strapi.log.info('处理checkout.session.completed事件');
                                await paymentController.handleCheckoutSessionCompleted(event.data.object);
                                break;
                            case 'payment_intent.succeeded':
                                strapi.log.info('处理payment_intent.succeeded事件');
                                await paymentController.handlePaymentSucceeded(event.data.object);
                                break;
                            case 'payment_intent.payment_failed':
                                strapi.log.info('处理payment_intent.payment_failed事件');
                                await paymentController.handlePaymentFailed(event.data.object);
                                break;
                            default:
                                strapi.log.info('未处理的事件类型:', event.type);
                        }
                        ctx.status = 200;
                        ctx.body = { received: true };
                    }
                    catch (error) {
                        strapi.log.error('Webhook处理器错误:', error);
                        ctx.status = 400;
                        ctx.body = { error: error.message };
                    }
                    return; // 不调用next()，结束处理
                }
                // 其他请求正常处理
                await next();
            });
            // 重新添加现有中间件
            existingMiddleware.forEach(middleware => {
                koaApp.use(middleware);
            });
            strapi.log.info('Stripe webhook处理器添加完成');
        });
    },
};
