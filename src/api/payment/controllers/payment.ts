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

  // 处理Stripe webhook（简化调试版本）
  async webhook(ctx) {
    try {
      strapi.log.info('=== Webhook收到请求 ===');
      strapi.log.info('Method:', ctx.method);
      strapi.log.info('Path:', ctx.path);
      strapi.log.info('Headers:', JSON.stringify(ctx.request.headers, null, 2));
      strapi.log.info('Body type:', typeof ctx.request.body);
      strapi.log.info('Body isBuffer:', Buffer.isBuffer(ctx.request.body));
      strapi.log.info('Body length:', ctx.request.body ? ctx.request.body.length : 0);
      
      // 检查Stripe签名是否存在
      const signature = ctx.request.headers['stripe-signature'];
      strapi.log.info('Stripe签名:', signature ? '存在' : '不存在');
      
      // 检查环境变量
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      strapi.log.info('Webhook密钥:', webhookSecret ? '已配置' : '未配置');
      
      strapi.log.info('=== 调试信息记录完成，返回成功 ===');
      
      // 直接返回成功，不做任何处理
      return ctx.send({ received: true, debug: 'webhook received successfully' });
    } catch (error) {
      strapi.log.error('Webhook处理失败:', error);
      strapi.log.error('错误堆栈:', error.stack);
      // 即使出错也返回成功，避免500错误
      return ctx.send({ received: true, debug: 'webhook received with error', error: error.message });
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