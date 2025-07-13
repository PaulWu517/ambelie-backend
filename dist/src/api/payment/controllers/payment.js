"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
const stripe_1 = require("../../../services/stripe");
exports.default = strapi_1.factories.createCoreController('api::payment.payment', ({ strapi }) => ({
    // 创建支付会话
    async createCheckoutSession(ctx) {
        try {
            const { orderItems, customerEmail, customerName, successUrl, cancelUrl, metadata } = ctx.request.body;
            // 验证必需字段
            if (!orderItems || !customerEmail || !customerName) {
                return ctx.badRequest('缺少必需的参数');
            }
            // 验证orderItems格式
            if (!Array.isArray(orderItems) || orderItems.length === 0) {
                return ctx.badRequest('订单项不能为空');
            }
            // 创建支付会话
            const session = await (0, stripe_1.createCheckoutSession)({
                orderItems,
                customerEmail,
                customerName,
                successUrl: successUrl || `${process.env.FRONTEND_URL}/order/success`,
                cancelUrl: cancelUrl || `${process.env.FRONTEND_URL}/cart`,
                metadata,
            });
            return ctx.send({
                success: true,
                data: session,
            });
        }
        catch (error) {
            strapi.log.error('创建支付会话失败:', error);
            return ctx.internalServerError('创建支付会话失败');
        }
    },
    // 处理Stripe webhook（按照官方文档实现）
    async webhook(ctx) {
        let event;
        try {
            // 获取原始payload和signature header
            const payload = ctx.request.body;
            const sig = ctx.request.headers['stripe-signature'];
            strapi.log.info('Webhook收到请求');
            strapi.log.info('Payload类型:', typeof payload);
            strapi.log.info('Payload是Buffer:', Buffer.isBuffer(payload));
            strapi.log.info('Payload长度:', payload ? payload.length : 0);
            strapi.log.info('Signature存在:', !!sig);
            // 检查必需的参数
            if (!payload) {
                strapi.log.error('缺少payload');
                return ctx.badRequest('缺少payload');
            }
            if (!sig) {
                strapi.log.error('缺少Stripe签名');
                return ctx.badRequest('缺少Stripe签名');
            }
            // 确保signature是string类型
            const signature = Array.isArray(sig) ? sig[0] : sig;
            if (!signature) {
                strapi.log.error('Stripe签名格式错误');
                return ctx.badRequest('Stripe签名格式错误');
            }
            const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
            if (!webhookSecret) {
                strapi.log.error('STRIPE_WEBHOOK_SECRET未配置');
                return ctx.internalServerError('Webhook配置错误');
            }
            // 验证webhook签名并构建事件对象
            event = await (0, stripe_1.verifyWebhookSignature)(payload, signature);
            strapi.log.info('Webhook签名验证成功，事件类型:', event.type);
        }
        catch (err) {
            strapi.log.error('Webhook签名验证失败:', err.message);
            return ctx.badRequest(`Webhook签名验证失败: ${err.message}`);
        }
        // 处理事件
        try {
            switch (event.type) {
                case 'checkout.session.completed':
                    strapi.log.info('处理checkout.session.completed事件');
                    await this.handleCheckoutSessionCompleted(event.data.object);
                    break;
                case 'payment_intent.succeeded':
                    strapi.log.info('处理payment_intent.succeeded事件');
                    await this.handlePaymentSucceeded(event.data.object);
                    break;
                case 'payment_intent.payment_failed':
                    strapi.log.info('处理payment_intent.payment_failed事件');
                    await this.handlePaymentFailed(event.data.object);
                    break;
                default:
                    strapi.log.info('未处理的事件类型:', event.type);
            }
            // 返回200状态码确认收到事件
            return ctx.send({ received: true });
        }
        catch (err) {
            strapi.log.error('处理webhook事件失败:', err);
            // 即使处理失败，也返回200避免Stripe重试
            return ctx.send({ received: true, error: 'Event processing failed' });
        }
    },
    // 处理支付会话完成
    async handleCheckoutSessionCompleted(session) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        try {
            // 获取详细的session信息
            const fullSession = await (0, stripe_1.getCheckoutSession)(session.id);
            // 创建或更新订单
            const orderData = {
                orderNumber: `ORDER-${Date.now()}`,
                status: 'paid',
                totalAmount: (fullSession.amount_total || 0) / 100, // 转换为元
                subtotal: (fullSession.amount_subtotal || 0) / 100,
                currency: ((_a = fullSession.currency) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'USD',
                customerEmail: ((_b = fullSession.customer_details) === null || _b === void 0 ? void 0 : _b.email) || '',
                customerName: ((_c = fullSession.customer_details) === null || _c === void 0 ? void 0 : _c.name) || '',
                customerPhone: ((_d = fullSession.customer_details) === null || _d === void 0 ? void 0 : _d.phone) || '',
                shippingAddress: ((_e = fullSession.shipping_details) === null || _e === void 0 ? void 0 : _e.address) || ((_f = fullSession.customer_details) === null || _f === void 0 ? void 0 : _f.address) || {},
                billingAddress: ((_g = fullSession.customer_details) === null || _g === void 0 ? void 0 : _g.address) || {},
                orderDate: new Date().toISOString(),
            };
            const order = await strapi.entityService.create('api::order.order', {
                data: orderData,
            });
            // 创建支付记录
            const paymentIntentId = typeof fullSession.payment_intent === 'string'
                ? fullSession.payment_intent
                : (_h = fullSession.payment_intent) === null || _h === void 0 ? void 0 : _h.id;
            await strapi.entityService.create('api::payment.payment', {
                data: {
                    paymentId: paymentIntentId || fullSession.id,
                    amount: (fullSession.amount_total || 0) / 100,
                    currency: ((_j = fullSession.currency) === null || _j === void 0 ? void 0 : _j.toUpperCase()) || 'USD',
                    status: 'succeeded',
                    paymentMethod: ((_k = fullSession.payment_method_types) === null || _k === void 0 ? void 0 : _k[0]) || 'card',
                    provider: 'stripe',
                    providerTransactionId: fullSession.id,
                    order: order.id,
                    paymentDate: new Date().toISOString(),
                    metadata: {
                        sessionId: session.id,
                        customerEmail: (_l = fullSession.customer_details) === null || _l === void 0 ? void 0 : _l.email,
                        customerName: (_m = fullSession.customer_details) === null || _m === void 0 ? void 0 : _m.name,
                    },
                },
            });
            strapi.log.info(`订单 ${order.orderNumber} 创建成功`);
        }
        catch (error) {
            strapi.log.error('处理支付会话完成事件失败:', error);
        }
    },
    // 处理支付成功
    async handlePaymentSucceeded(paymentIntent) {
        try {
            // 更新支付状态
            await strapi.db.query('api::payment.payment').update({
                where: { paymentId: paymentIntent.id },
                data: { status: 'succeeded' },
            });
            strapi.log.info(`支付 ${paymentIntent.id} 成功`);
        }
        catch (error) {
            strapi.log.error('处理支付成功事件失败:', error);
        }
    },
    // 处理支付失败
    async handlePaymentFailed(paymentIntent) {
        var _a;
        try {
            // 更新支付状态
            await strapi.db.query('api::payment.payment').update({
                where: { paymentId: paymentIntent.id },
                data: {
                    status: 'failed',
                    failureReason: ((_a = paymentIntent.last_payment_error) === null || _a === void 0 ? void 0 : _a.message) || '支付失败',
                },
            });
            strapi.log.info(`支付 ${paymentIntent.id} 失败`);
        }
        catch (error) {
            strapi.log.error('处理支付失败事件失败:', error);
        }
    },
    // 获取支付会话详情
    async getSessionDetails(ctx) {
        try {
            const { sessionId } = ctx.params;
            if (!sessionId) {
                return ctx.badRequest('缺少会话ID');
            }
            const session = await (0, stripe_1.getCheckoutSession)(sessionId);
            return ctx.send({
                success: true,
                data: session,
            });
        }
        catch (error) {
            strapi.log.error('获取支付会话详情失败:', error);
            return ctx.internalServerError('获取支付会话详情失败');
        }
    },
}));
