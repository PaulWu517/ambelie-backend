import Stripe from 'stripe';

// 检查Stripe密钥是否配置
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn('⚠️  STRIPE_SECRET_KEY 未配置，Stripe功能将不可用');
}

// 初始化Stripe实例（如果密钥存在）
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2025-06-30.basil',
}) : null;

// 创建支付会话
export const createCheckoutSession = async (params: {
  orderItems: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    productName: string;
  }>;
  customerEmail: string;
  customerName: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) => {
  if (!stripe) {
    throw new Error('Stripe未配置，无法创建支付会话');
  }
  
  try {
    const { orderItems, customerEmail, customerName, successUrl, cancelUrl, metadata } = params;

    // 构建line_items
    const lineItems = orderItems.map(item => ({
      price_data: {
        currency: process.env.PAYMENT_CURRENCY || 'USD',
        product_data: {
          name: item.productName,
        },
        unit_amount: Math.round(item.unitPrice * 100), // Stripe使用分为单位
      },
      quantity: item.quantity,
    }));

    // 创建checkout session
    const session = await stripe.checkout.sessions.create({
      // 保留信用卡（Apple Pay/Google Pay 会在满足条件时随卡自动出现）
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail,
      metadata: {
        customerName,
        ...metadata,
      },
      // 确保PaymentIntent也包含相同的metadata
      payment_intent_data: {
        metadata: {
          customerName,
          ...metadata,
        },
      },
      // 开启在结账完成后自动生成发票（Paid Invoice）
      // Stripe 会在支付成功后创建并标记为已支付的发票；
      // 客户邮件发送由仪表盘的“Customer emails”开关控制。
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description: 'Order invoice',
          // 将 checkout 的元数据透传到发票，便于后续对账
          metadata: {
            customerName,
            ...metadata,
          },
          // 如果在环境变量中配置了账户税号，可附加到发票上（部分地区税务合规需要）
          ...(process.env.ACCOUNT_TAX_ID
            ? { account_tax_ids: [process.env.ACCOUNT_TAX_ID] }
            : {}),
        },
      },
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'CN', 'HK', 'TW', 'SG', 'JP', 'KR'],
      },
      phone_number_collection: {
        enabled: true,
      },
    });
    
    strapi.log.info(`Stripe session创建成功: ${session.id}, PaymentIntent: ${session.payment_intent}`);
    
    // 如果有PaymentIntent，更新其metadata以包含sessionId
    if (session.payment_intent && typeof session.payment_intent === 'string') {
      try {
        await stripe.paymentIntents.update(session.payment_intent, {
          metadata: {
            sessionId: session.id,
            customerName,
            ...metadata,
          },
        });
        strapi.log.info(`PaymentIntent ${session.payment_intent} metadata已更新，包含sessionId: ${session.id}`);
      } catch (updateError) {
        strapi.log.warn(`更新PaymentIntent metadata失败:`, updateError);
      }
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  } catch (error) {
    strapi.log.error('创建Stripe checkout session失败:', error);
    throw new Error('创建支付会话失败');
  }
};

// 验证webhook签名
export const verifyWebhookSignature = (payload: string | Buffer, signature: string) => {
  if (!stripe) {
    throw new Error('Stripe未配置，无法验证webhook签名');
  }
  
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET未配置');
  }
  
  try {
    strapi.log.info(`验证webhook签名`);
    strapi.log.info(`Payload类型: ${typeof payload}, 是Buffer: ${Buffer.isBuffer(payload)}, 长度: ${payload.length}`);
    strapi.log.info(`签名: ${signature}`);
    strapi.log.info(`Webhook密钥前缀: ${webhookSecret.substring(0, 10)}...`);
    
    // 使用Stripe官方推荐的方法验证签名
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
    
    strapi.log.info(`Webhook签名验证成功，事件类型: ${event.type}, 事件ID: ${event.id}`);
    return event;
  } catch (error) {
    strapi.log.error('Webhook签名验证失败:', {
      error: error.message,
      payloadType: typeof payload,
      payloadLength: payload ? payload.length : 0,
      isBuffer: Buffer.isBuffer(payload),
      signature: signature,
      webhookSecretPrefix: webhookSecret.substring(0, 10) + '...'
    });
    throw new Error(`Webhook签名验证失败: ${error.message}`);
  }
};

// 获取支付会话详情
export const getCheckoutSession = async (sessionId: string) => {
  if (!stripe) {
    throw new Error('Stripe未配置，无法获取支付会话详情');
  }
  
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'payment_intent'],
    });
    return session;
  } catch (error) {
    strapi.log.error('获取支付会话详情失败:', error);
    throw new Error('获取支付会话详情失败');
  }
};

// 创建退款
export const createRefund = async (paymentIntentId: string, amount?: number) => {
  if (!stripe) {
    throw new Error('Stripe未配置，无法创建退款');
  }
  
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined, // 如果不指定金额，则全额退款
    });
    return refund;
  } catch (error) {
    strapi.log.error('创建退款失败:', error);
    throw new Error('创建退款失败');
  }
};

export default stripe;