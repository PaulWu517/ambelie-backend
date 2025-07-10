import Stripe from 'stripe';

// 延迟初始化Stripe实例，避免在没有密钥时出错
let stripe: Stripe | null = null;

const getStripeInstance = (): Stripe => {
  if (!stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY 环境变量未设置');
    }
    stripe = new Stripe(secretKey, {
      apiVersion: '2025-06-30.basil',
    });
  }
  return stripe;
};

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
    const session = await getStripeInstance().checkout.sessions.create({
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
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'CN', 'HK', 'TW', 'SG', 'JP', 'KR'],
      },
      phone_number_collection: {
        enabled: true,
      },
    });

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
export const verifyWebhookSignature = (payload: string, signature: string) => {
  try {
    const event = getStripeInstance().webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
    return event;
  } catch (error) {
    strapi.log.error('Webhook签名验证失败:', error);
    throw new Error('Webhook签名验证失败');
  }
};

// 获取支付会话详情
export const getCheckoutSession = async (sessionId: string) => {
  try {
    const session = await getStripeInstance().checkout.sessions.retrieve(sessionId, {
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
  try {
    const refund = await getStripeInstance().refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined, // 如果不指定金额，则全额退款
    });
    return refund;
  } catch (error) {
    strapi.log.error('创建退款失败:', error);
    throw new Error('创建退款失败');
  }
};

export default getStripeInstance; 