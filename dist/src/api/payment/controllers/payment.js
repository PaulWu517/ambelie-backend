"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePaymentFailed = exports.handlePaymentSucceeded = exports.handleCheckoutSessionCompleted = void 0;
const strapi_1 = require("@strapi/strapi");
const stripe_1 = require("../../../services/stripe");
// 处理支付会话完成
async function handleCheckoutSessionCompleted(session, strapi) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
    try {
        strapi.log.info(`开始处理支付会话完成事件，Session ID: ${session.id}`);
        // 获取详细的session信息
        const fullSession = await (0, stripe_1.getCheckoutSession)(session.id);
        strapi.log.info(`Session metadata:`, JSON.stringify(fullSession.metadata, null, 2));
        // 从metadata中获取订单项信息
        const orderItemsData = ((_a = fullSession.metadata) === null || _a === void 0 ? void 0 : _a.items) ? JSON.parse(fullSession.metadata.items) : [];
        const tempOrderNumber = (_b = fullSession.metadata) === null || _b === void 0 ? void 0 : _b.tempOrderNumber;
        strapi.log.info(`订单项数量: ${orderItemsData.length}, 临时订单号: ${tempOrderNumber}`);
        // 检查是否有关联的Website User
        let websiteUser = null;
        if ((_c = fullSession.metadata) === null || _c === void 0 ? void 0 : _c.websiteUserId) {
            try {
                websiteUser = await strapi.entityService.findOne('api::website-user.website-user', parseInt(fullSession.metadata.websiteUserId));
                console.log('Found associated website user:', websiteUser === null || websiteUser === void 0 ? void 0 : websiteUser.email);
            }
            catch (userError) {
                console.log('Could not find website user:', userError.message);
            }
        }
        // 获取 payment intent ID 以确定订单初始状态
        const paymentIntentId = typeof fullSession.payment_intent === 'string'
            ? fullSession.payment_intent
            : (_d = fullSession.payment_intent) === null || _d === void 0 ? void 0 : _d.id;
        // 创建订单数据
        const orderData = {
            orderNumber: tempOrderNumber || `ORDER-${Date.now()}`, // 使用临时订单号或生成新的
            status: paymentIntentId ? 'pending' : 'paid', // 有 payment intent 时为 pending，等待支付完成
            totalAmount: (fullSession.amount_total || 0) / 100, // 转换为元
            subtotal: (fullSession.amount_subtotal || 0) / 100,
            currency: ((_e = fullSession.currency) === null || _e === void 0 ? void 0 : _e.toUpperCase()) || 'USD',
            customerEmail: ((_f = fullSession.customer_details) === null || _f === void 0 ? void 0 : _f.email) || '',
            customerName: ((_g = fullSession.customer_details) === null || _g === void 0 ? void 0 : _g.name) || '',
            customerPhone: ((_h = fullSession.customer_details) === null || _h === void 0 ? void 0 : _h.phone) || '',
            shippingAddress: ((_j = fullSession.shipping_details) === null || _j === void 0 ? void 0 : _j.address) || ((_k = fullSession.customer_details) === null || _k === void 0 ? void 0 : _k.address) || {},
            billingAddress: ((_l = fullSession.customer_details) === null || _l === void 0 ? void 0 : _l.address) || {},
            orderDate: new Date().toISOString(),
            // 关联Website User（如果存在）
            ...(websiteUser && { customer: websiteUser.id }),
        };
        strapi.log.info(`准备创建订单: ${orderData.orderNumber}, PaymentIntent: ${paymentIntentId || 'None'}`);
        const order = await strapi.entityService.create('api::order.order', {
            data: orderData,
        });
        // 创建订单项 (Order-items) - 这是之前缺少的部分
        if (orderItemsData && orderItemsData.length > 0) {
            for (const item of orderItemsData) {
                try {
                    // 获取产品信息
                    const product = await strapi.entityService.findOne('api::product.product', item.productId);
                    if (product) {
                        // 创建产品快照
                        const productSnapshot = {
                            id: product.id,
                            name: product.name || '',
                            price: product.price || 0,
                            description: product.description || '',
                            slug: product.slug || '',
                        };
                        // 创建订单项
                        await strapi.entityService.create('api::order-item.order-item', {
                            data: {
                                quantity: item.quantity || 1,
                                unitPrice: item.unitPrice || product.price || 0,
                                totalPrice: (item.quantity || 1) * (item.unitPrice || product.price || 0),
                                product: item.productId,
                                order: order.id,
                                productSnapshot: productSnapshot,
                            },
                        });
                    }
                }
                catch (itemError) {
                    strapi.log.error(`创建订单项失败 - ProductID: ${item.productId}`, itemError);
                }
            }
        }
        // 创建支付记录
        // 只有在有有效的 payment intent ID 时才创建支付记录
        if (paymentIntentId) {
            await strapi.entityService.create('api::payment.payment', {
                data: {
                    paymentId: paymentIntentId,
                    orderNumber: order.orderNumber, // 添加订单号关联
                    amount: (fullSession.amount_total || 0) / 100,
                    currency: ((_m = fullSession.currency) === null || _m === void 0 ? void 0 : _m.toUpperCase()) || 'USD',
                    status: 'processing', // 初始状态为 processing，等待 payment_intent 事件更新
                    paymentMethod: ((_o = fullSession.payment_method_types) === null || _o === void 0 ? void 0 : _o[0]) || 'card',
                    provider: 'stripe',
                    providerTransactionId: fullSession.id,
                    order: order.id,
                    paymentDate: new Date().toISOString(),
                    metadata: {
                        sessionId: fullSession.id,
                        customerEmail: (_p = fullSession.customer_details) === null || _p === void 0 ? void 0 : _p.email,
                        customerName: (_q = fullSession.customer_details) === null || _q === void 0 ? void 0 : _q.name,
                        tempOrderNumber: tempOrderNumber,
                    },
                },
            });
            strapi.log.info(`支付记录创建成功，PaymentIntent ID: ${paymentIntentId}, Order: ${order.orderNumber}`);
        }
        else {
            // 如果没有 payment intent，可能是免费订单或其他情况
            strapi.log.warn(`Checkout session ${fullSession.id} 没有关联的 payment_intent，可能是免费订单`);
            // 对于没有 payment intent 的情况，创建一个基于 session 的支付记录
            await strapi.entityService.create('api::payment.payment', {
                data: {
                    paymentId: fullSession.id, // 使用 session ID
                    orderNumber: order.orderNumber, // 添加订单号关联
                    amount: (fullSession.amount_total || 0) / 100,
                    currency: ((_r = fullSession.currency) === null || _r === void 0 ? void 0 : _r.toUpperCase()) || 'USD',
                    status: 'succeeded', // 直接标记为成功
                    paymentMethod: ((_s = fullSession.payment_method_types) === null || _s === void 0 ? void 0 : _s[0]) || 'free',
                    provider: 'stripe',
                    providerTransactionId: fullSession.id,
                    order: order.id,
                    paymentDate: new Date().toISOString(),
                    metadata: {
                        sessionId: fullSession.id,
                        customerEmail: (_t = fullSession.customer_details) === null || _t === void 0 ? void 0 : _t.email,
                        customerName: (_u = fullSession.customer_details) === null || _u === void 0 ? void 0 : _u.name,
                        tempOrderNumber: tempOrderNumber,
                        note: 'No payment intent - possibly free order',
                    },
                },
            });
        }
        strapi.log.info(`订单 ${order.orderNumber} 创建成功，包含 ${orderItemsData.length} 个订单项`);
    }
    catch (error) {
        strapi.log.error('处理支付会话完成事件失败:', error);
    }
}
exports.handleCheckoutSessionCompleted = handleCheckoutSessionCompleted;
// 处理支付成功
async function handlePaymentSucceeded(paymentIntent, strapi) {
    try {
        strapi.log.info(`开始处理支付成功事件，PaymentIntent ID: ${paymentIntent.id}`);
        // 首先通过 paymentId 字段查找支付记录
        let payments = await strapi.entityService.findMany('api::payment.payment', {
            filters: { paymentId: paymentIntent.id },
            populate: ['order'],
        });
        // 如果通过 paymentId 找不到，尝试通过 providerTransactionId 查找（备用匹配）
        if (!payments || payments.length === 0) {
            strapi.log.warn(`通过 paymentId ${paymentIntent.id} 未找到支付记录，尝试备用匹配`);
            // 尝试通过 metadata 中的 sessionId 查找
            if (paymentIntent.metadata && paymentIntent.metadata.sessionId) {
                payments = await strapi.entityService.findMany('api::payment.payment', {
                    filters: { providerTransactionId: paymentIntent.metadata.sessionId },
                    populate: ['order'],
                });
                strapi.log.info(`通过 sessionId ${paymentIntent.metadata.sessionId} 找到 ${payments.length} 条支付记录`);
            }
        }
        if (payments && payments.length > 0) {
            // 更新支付记录状态
            for (const payment of payments) {
                await strapi.entityService.update('api::payment.payment', payment.id, {
                    data: {
                        status: 'succeeded',
                        paymentId: paymentIntent.id, // 确保 paymentId 正确
                    },
                });
                strapi.log.info(`支付记录 ${payment.id} 状态更新为成功，订单号: ${payment.orderNumber}`);
                // 更新关联订单的状态为已支付
                if (payment.order) {
                    await strapi.entityService.update('api::order.order', payment.order.id, {
                        data: { status: 'paid' },
                    });
                    strapi.log.info(`订单 ${payment.order.orderNumber} 状态更新为已支付`);
                }
            }
        }
        else {
            strapi.log.error(`无法找到与 PaymentIntent ${paymentIntent.id} 匹配的支付记录`);
            strapi.log.error(`PaymentIntent metadata:`, JSON.stringify(paymentIntent.metadata, null, 2));
        }
    }
    catch (error) {
        strapi.log.error('处理支付成功事件失败:', error);
    }
}
exports.handlePaymentSucceeded = handlePaymentSucceeded;
// 处理支付失败
async function handlePaymentFailed(paymentIntent, strapi) {
    var _a;
    try {
        strapi.log.info(`开始处理支付失败事件，PaymentIntent ID: ${paymentIntent.id}`);
        // 首先通过 paymentId 字段查找支付记录
        let payments = await strapi.entityService.findMany('api::payment.payment', {
            filters: { paymentId: paymentIntent.id },
            populate: ['order'],
        });
        // 如果通过 paymentId 找不到，尝试通过 providerTransactionId 查找（备用匹配）
        if (!payments || payments.length === 0) {
            strapi.log.warn(`通过 paymentId ${paymentIntent.id} 未找到支付记录，尝试备用匹配`);
            // 尝试通过 metadata 中的 sessionId 查找
            if (paymentIntent.metadata && paymentIntent.metadata.sessionId) {
                payments = await strapi.entityService.findMany('api::payment.payment', {
                    filters: { providerTransactionId: paymentIntent.metadata.sessionId },
                    populate: ['order'],
                });
                strapi.log.info(`通过 sessionId ${paymentIntent.metadata.sessionId} 找到 ${payments.length} 条支付记录`);
            }
        }
        if (payments && payments.length > 0) {
            // 更新支付记录状态
            for (const payment of payments) {
                await strapi.entityService.update('api::payment.payment', payment.id, {
                    data: {
                        status: 'failed',
                        paymentId: paymentIntent.id, // 确保 paymentId 正确
                        failureReason: ((_a = paymentIntent.last_payment_error) === null || _a === void 0 ? void 0 : _a.message) || '支付失败',
                    },
                });
                strapi.log.info(`支付记录 ${payment.id} 状态更新为失败，订单号: ${payment.orderNumber}`);
                // 更新关联订单的状态为失败
                if (payment.order) {
                    await strapi.entityService.update('api::order.order', payment.order.id, {
                        data: { status: 'payment_failed' },
                    });
                    strapi.log.info(`订单 ${payment.order.orderNumber} 状态更新为支付失败`);
                }
            }
        }
        else {
            strapi.log.error(`无法找到与 PaymentIntent ${paymentIntent.id} 匹配的支付记录`);
            strapi.log.error(`PaymentIntent metadata:`, JSON.stringify(paymentIntent.metadata, null, 2));
        }
    }
    catch (error) {
        strapi.log.error('处理支付失败事件失败:', error);
    }
}
exports.handlePaymentFailed = handlePaymentFailed;
exports.default = strapi_1.factories.createCoreController('api::payment.payment', ({ strapi }) => ({
    // 获取支付记录列表（带分页和过滤）
    async find(ctx) {
        try {
            console.log('Payments API find method called');
            console.log('Query params:', ctx.query);
            // 添加默认分页限制以防止性能问题
            const { page = 1, pageSize = 25, ...filters } = ctx.query;
            // 限制最大页面大小
            const limitedPageSize = Math.min(parseInt(pageSize) || 25, 100);
            const payments = await strapi.entityService.findMany('api::payment.payment', {
                ...filters,
                start: (parseInt(page) - 1) * limitedPageSize,
                limit: limitedPageSize,
                populate: {
                    order: {
                        populate: ['orderItems', 'customer'],
                    },
                },
                sort: { createdAt: 'desc' },
            });
            // 获取总数用于分页
            const total = await strapi.entityService.count('api::payment.payment', {
                ...filters,
            });
            console.log(`Found ${payments.length} payments out of ${total} total`);
            return ctx.send({
                success: true,
                data: payments,
                meta: {
                    pagination: {
                        page: parseInt(page),
                        pageSize: limitedPageSize,
                        pageCount: Math.ceil(total / limitedPageSize),
                        total,
                    },
                },
            });
        }
        catch (error) {
            console.error('获取支付记录列表失败:', error);
            strapi.log.error('获取支付记录列表失败:', error);
            return ctx.internalServerError('获取支付记录列表失败');
        }
    },
    // 创建Stripe Checkout会话
    async createCheckoutSession(ctx) {
        try {
            const { orderItems, customerEmail, customerName, successUrl, cancelUrl, metadata = {} } = ctx.request.body;
            if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
                return ctx.badRequest('订单项不能为空');
            }
            // 检查用户认证token
            let websiteUser = null;
            const authHeader = ctx.request.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                try {
                    const userInfo = await strapi.service('api::website-user.website-user').verifyUserToken(token);
                    if (userInfo) {
                        websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId);
                    }
                }
                catch (tokenError) {
                    console.log('Invalid user token, continuing as guest:', tokenError.message);
                }
            }
            // 生成临时订单号用于跟踪
            const tempOrderNumber = `TEMP-ORDER-${Date.now()}`;
            // 构建元数据，包含用户信息和订单号
            const enhancedMetadata = {
                ...metadata,
                items: JSON.stringify(orderItems),
                tempOrderNumber: tempOrderNumber, // 添加临时订单号
                // 如果有登录用户，保存用户ID
                ...(websiteUser && { websiteUserId: websiteUser.id.toString() }),
                ...(websiteUser && { websiteUserEmail: websiteUser.email }),
            };
            // 规范化成功/取消回跳地址：优先使用后端环境变量，其次使用前端传入，最后使用默认站点
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://www.ambelie.com';
            const successBase = process.env.PAYMENT_SUCCESS_URL || successUrl || `${siteUrl}/order/success`;
            const cancelBase = process.env.PAYMENT_CANCEL_URL || cancelUrl || `${siteUrl}/cart`;
            // Stripe 要求在 success_url 中使用 {CHECKOUT_SESSION_ID} 以便回跳后识别
            const successWithParams = `${successBase}${successBase.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}${customerEmail ? `&email=${encodeURIComponent(customerEmail)}` : ''}`;
            const cancelWithParams = cancelBase;
            strapi.log.info(`创建支付会话，临时订单号: ${tempOrderNumber}`);
            // 创建checkout session
            const session = await (0, stripe_1.createCheckoutSession)({
                orderItems,
                customerEmail,
                customerName,
                successUrl: successWithParams,
                cancelUrl: cancelWithParams,
                metadata: enhancedMetadata,
            });
            return ctx.send({
                success: true,
                data: {
                    id: session.sessionId,
                    url: session.url,
                },
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
                    await handleCheckoutSessionCompleted(event.data.object, strapi);
                    break;
                case 'payment_intent.succeeded':
                    strapi.log.info('处理payment_intent.succeeded事件');
                    await handlePaymentSucceeded(event.data.object, strapi);
                    break;
                case 'payment_intent.payment_failed':
                    strapi.log.info('处理payment_intent.payment_failed事件');
                    await handlePaymentFailed(event.data.object, strapi);
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
