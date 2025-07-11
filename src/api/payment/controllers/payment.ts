import { factories } from '@strapi/strapi';
import { createCheckoutSession, verifyWebhookSignature, getCheckoutSession } from '../../../services/stripe';
 
export default factories.createCoreController('api::payment.payment', ({ strapi }) => ({
  
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
      const session = await createCheckoutSession({
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
    } catch (error) {
      strapi.log.error('创建支付会话失败:', error);
      return ctx.internalServerError('创建支付会话失败');
    }
  },

  // 处理Stripe webhook（按照官方文档实现）
  async webhook(ctx) {
    strapi.log.info('Webhook endpoint called');
    
    try {
      // 1. 获取Stripe签名
      const signature = Array.isArray(ctx.request.headers['stripe-signature']) 
        ? ctx.request.headers['stripe-signature'][0] 
        : ctx.request.headers['stripe-signature'];
      if (!signature) {
        strapi.log.error('No Stripe signature found');
        return ctx.badRequest('Missing Stripe signature');
      }

      // 2. 获取webhook密钥
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!endpointSecret) {
        strapi.log.error('STRIPE_WEBHOOK_SECRET not configured');
        return ctx.badRequest('Webhook secret not configured');
      }

      // 3. 读取原始请求体（关键：按照官方文档要求）
      let payload;
      
      // 由于设置了parse: false，ctx.request.body应该是原始数据
      if (ctx.request.body) {
        payload = ctx.request.body;
      } else {
        // 如果没有body，手动从请求流读取
        const chunks = [];
        for await (const chunk of ctx.req) {
          chunks.push(chunk);
        }
        payload = Buffer.concat(chunks);
      }

      strapi.log.info(`Payload type: ${typeof payload}, isBuffer: ${Buffer.isBuffer(payload)}, length: ${payload ? payload.length : 0}`);

      // 4. 验证签名并构造事件（按照官方文档）
      let event;
      try {
        event = await verifyWebhookSignature(payload, signature);
        strapi.log.info(`Event verified: ${event.type}`);
      } catch (err) {
        strapi.log.error('Webhook signature verification failed:', err.message);
        return ctx.badRequest('Webhook signature verification failed');
      }

      // 5. 处理事件（按照官方文档的建议）
      switch (event.type) {
        case 'checkout.session.completed':
          strapi.log.info('Processing checkout.session.completed');
          await this.handleCheckoutSessionCompleted(event.data.object);
          break;
        case 'payment_intent.succeeded':
          strapi.log.info('Processing payment_intent.succeeded');
          await this.handlePaymentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          strapi.log.info('Processing payment_intent.payment_failed');
          await this.handlePaymentFailed(event.data.object);
          break;
        default:
          strapi.log.info(`Unhandled event type: ${event.type}`);
      }

      // 6. 按照官方文档：快速返回成功状态码
      return ctx.send({ received: true });

    } catch (error) {
      strapi.log.error('Webhook processing error:', error);
      // 即使出错也返回200，避免Stripe重试
      return ctx.send({ received: true, error: 'processed with error' });
    }
  },

  // 处理支付会话完成
  async handleCheckoutSessionCompleted(session) {
    try {
      // 获取详细的session信息
      const fullSession = await getCheckoutSession(session.id);
      
      // 创建或更新订单
      const orderData = {
        orderNumber: `ORDER-${Date.now()}`,
        status: 'paid' as const,
        totalAmount: (fullSession.amount_total || 0) / 100, // 转换为元
        subtotal: (fullSession.amount_subtotal || 0) / 100,
        currency: fullSession.currency?.toUpperCase() || 'USD',
        customerEmail: fullSession.customer_details?.email || '',
        customerName: fullSession.customer_details?.name || '',
        customerPhone: fullSession.customer_details?.phone || '',
        shippingAddress: (fullSession as any).shipping_details?.address || fullSession.customer_details?.address || {},
        billingAddress: fullSession.customer_details?.address || {},
        orderDate: new Date().toISOString(),
      };

      const order = await strapi.entityService.create('api::order.order', {
        data: orderData,
      });

      // 创建支付记录
      const paymentIntentId = typeof fullSession.payment_intent === 'string' 
        ? fullSession.payment_intent 
        : fullSession.payment_intent?.id;

      await strapi.entityService.create('api::payment.payment', {
        data: {
          paymentId: paymentIntentId || fullSession.id,
          amount: (fullSession.amount_total || 0) / 100,
          currency: fullSession.currency?.toUpperCase() || 'USD',
          status: 'succeeded' as const,
          paymentMethod: fullSession.payment_method_types?.[0] || 'card',
          provider: 'stripe' as const,
          providerTransactionId: fullSession.id,
          order: order.id,
          paymentDate: new Date().toISOString(),
          metadata: {
            sessionId: session.id,
            customerEmail: fullSession.customer_details?.email,
            customerName: fullSession.customer_details?.name,
          },
        },
      });

      strapi.log.info(`订单 ${order.orderNumber} 创建成功`);
    } catch (error) {
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
    } catch (error) {
      strapi.log.error('处理支付成功事件失败:', error);
    }
  },

  // 处理支付失败
  async handlePaymentFailed(paymentIntent) {
    try {
      // 更新支付状态
      await strapi.db.query('api::payment.payment').update({
        where: { paymentId: paymentIntent.id },
        data: { 
          status: 'failed',
          failureReason: paymentIntent.last_payment_error?.message || '支付失败',
        },
      });

      strapi.log.info(`支付 ${paymentIntent.id} 失败`);
    } catch (error) {
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

      const session = await getCheckoutSession(sessionId);
      
      return ctx.send({
        success: true,
        data: session,
      });
    } catch (error) {
      strapi.log.error('获取支付会话详情失败:', error);
      return ctx.internalServerError('获取支付会话详情失败');
    }
  },

})); 