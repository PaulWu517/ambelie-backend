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

  // 处理Stripe webhook
  async webhook(ctx) {
    try {
      const sig = Array.isArray(ctx.request.headers['stripe-signature']) 
        ? ctx.request.headers['stripe-signature'][0] 
        : ctx.request.headers['stripe-signature'];

      if (!sig) {
        return ctx.badRequest('缺少Stripe签名');
      }

      // 获取请求体数据
      let payload: Buffer | string;
      
      // 尝试不同的方法获取原始请求体
      if (ctx.request.body && typeof ctx.request.body === 'string') {
        // 如果是字符串，直接使用
        payload = ctx.request.body;
        strapi.log.info('使用字符串格式的请求体');
      } else if (ctx.request.body && Buffer.isBuffer(ctx.request.body)) {
        // 如果是Buffer，直接使用
        payload = ctx.request.body;
        strapi.log.info('使用Buffer格式的请求体');
      } else if (ctx.request.body && typeof ctx.request.body === 'object') {
        // 如果是对象，转换为JSON字符串
        payload = JSON.stringify(ctx.request.body);
        strapi.log.info('使用对象转JSON格式的请求体');
      } else {
        // 最后的fallback：空字符串
        payload = '';
        strapi.log.warn('无法获取请求体，使用空字符串');
      }

      strapi.log.info(`Webhook payload type: ${typeof payload}, length: ${payload.length}`);

      // 验证webhook签名（直接使用原始payload）
      const event = verifyWebhookSignature(payload, sig);

      // 处理不同的事件类型
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object as any);
          break;
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object as any);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object as any);
          break;
        default:
          strapi.log.info(`未处理的事件类型: ${event.type}`);
      }

      return ctx.send({ received: true });
    } catch (error) {
      strapi.log.error('Webhook处理失败:', error);
      return ctx.badRequest('Webhook处理失败');
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