import { factories } from '@strapi/strapi';
import { createCheckoutSession, verifyWebhookSignature, getCheckoutSession } from '../../../services/stripe';

// 处理支付会话完成
async function handleCheckoutSessionCompleted(session, strapi) {
  try {
    strapi.log.info(`开始处理支付会话完成事件，Session ID: ${session.id}`);
    
    // 获取详细的session信息
    const fullSession = await getCheckoutSession(session.id);
    
    strapi.log.info(`Session metadata:`, JSON.stringify(fullSession.metadata, null, 2));
    
    // 从metadata中获取订单项信息
    const orderItemsData = fullSession.metadata?.items ? JSON.parse(fullSession.metadata.items) : [];
    const tempOrderNumber = fullSession.metadata?.tempOrderNumber;
    
    strapi.log.info(`订单项数量: ${orderItemsData.length}, 临时订单号: ${tempOrderNumber}`);
    
    // 检查是否有关联的Website User
    let websiteUser = null;
    if (fullSession.metadata?.websiteUserId) {
      try {
        websiteUser = await strapi.entityService.findOne('api::website-user.website-user', parseInt(fullSession.metadata.websiteUserId));
        console.log('Found associated website user:', websiteUser?.email);
      } catch (userError) {
        console.log('Could not find website user:', userError.message);
      }
    }
    
    // 获取 payment intent ID 以确定订单初始状态
    const paymentIntentId = typeof fullSession.payment_intent === 'string' 
      ? fullSession.payment_intent 
      : fullSession.payment_intent?.id;

    // 创建订单数据
    const orderData = {
      orderNumber: tempOrderNumber || `ORDER-${Date.now()}`, // 使用临时订单号或生成新的
      status: paymentIntentId ? 'pending' : 'paid', // 有 payment intent 时为 pending，等待支付完成
      totalAmount: (fullSession.amount_total || 0) / 100, // 转换为元
      subtotal: (fullSession.amount_subtotal || 0) / 100,
      currency: fullSession.currency?.toUpperCase() || 'USD',
      customerEmail: fullSession.customer_details?.email || '',
      customerName: fullSession.customer_details?.name || '',
      customerPhone: fullSession.customer_details?.phone || '',
      shippingAddress: (fullSession as any).shipping_details?.address || fullSession.customer_details?.address || {},
      billingAddress: fullSession.customer_details?.address || {},
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
        } catch (itemError) {
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
          currency: fullSession.currency?.toUpperCase() || 'USD',
          status: 'processing', // 初始状态为 processing，等待 payment_intent 事件更新
          paymentMethod: fullSession.payment_method_types?.[0] || 'card',
          provider: 'stripe' as const,
          providerTransactionId: fullSession.id,
          order: order.id,
          paymentDate: new Date().toISOString(),
          metadata: {
            sessionId: fullSession.id,
            customerEmail: fullSession.customer_details?.email,
            customerName: fullSession.customer_details?.name,
            tempOrderNumber: tempOrderNumber,
          },
        },
      });
      strapi.log.info(`支付记录创建成功，PaymentIntent ID: ${paymentIntentId}, Order: ${order.orderNumber}`);
    } else {
      // 如果没有 payment intent，可能是免费订单或其他情况
      strapi.log.warn(`Checkout session ${fullSession.id} 没有关联的 payment_intent，可能是免费订单`);
      
      // 对于没有 payment intent 的情况，创建一个基于 session 的支付记录
      await strapi.entityService.create('api::payment.payment', {
        data: {
          paymentId: fullSession.id, // 使用 session ID
          orderNumber: order.orderNumber, // 添加订单号关联
          amount: (fullSession.amount_total || 0) / 100,
          currency: fullSession.currency?.toUpperCase() || 'USD',
          status: 'succeeded', // 直接标记为成功
          paymentMethod: fullSession.payment_method_types?.[0] || 'free',
          provider: 'stripe' as const,
          providerTransactionId: fullSession.id,
          order: order.id,
          paymentDate: new Date().toISOString(),
          metadata: {
            sessionId: fullSession.id,
            customerEmail: fullSession.customer_details?.email,
            customerName: fullSession.customer_details?.name,
            tempOrderNumber: tempOrderNumber,
            note: 'No payment intent - possibly free order',
          },
        },
      });
    }

    strapi.log.info(`订单 ${order.orderNumber} 创建成功，包含 ${orderItemsData.length} 个订单项`);
  } catch (error) {
    strapi.log.error('处理支付会话完成事件失败:', error);
  }
}

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
    } else {
      strapi.log.error(`无法找到与 PaymentIntent ${paymentIntent.id} 匹配的支付记录`);
      strapi.log.error(`PaymentIntent metadata:`, JSON.stringify(paymentIntent.metadata, null, 2));
    }
  } catch (error) {
    strapi.log.error('处理支付成功事件失败:', error);
  }
}

// 处理支付失败
async function handlePaymentFailed(paymentIntent, strapi) {
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
            failureReason: paymentIntent.last_payment_error?.message || '支付失败',
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
    } else {
      strapi.log.error(`无法找到与 PaymentIntent ${paymentIntent.id} 匹配的支付记录`);
      strapi.log.error(`PaymentIntent metadata:`, JSON.stringify(paymentIntent.metadata, null, 2));
    }
  } catch (error) {
    strapi.log.error('处理支付失败事件失败:', error);
  }
}
 
export default factories.createCoreController('api::payment.payment', ({ strapi }) => ({
  
  // 获取支付记录列表（带分页和过滤）
  async find(ctx) {
    try {
      console.log('Payments API find method called');
      console.log('Query params:', ctx.query);
      
      // 添加默认分页限制以防止性能问题
      const { page = 1, pageSize = 25, ...filters } = ctx.query;
      
      // 限制最大页面大小
      const limitedPageSize = Math.min(parseInt(pageSize as string) || 25, 100);
      
      const payments = await strapi.entityService.findMany('api::payment.payment', {
        ...filters,
        start: (parseInt(page as string) - 1) * limitedPageSize,
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
            page: parseInt(page as string),
            pageSize: limitedPageSize,
            pageCount: Math.ceil(total / limitedPageSize),
            total,
          },
        },
      });
    } catch (error) {
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
        } catch (tokenError) {
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
      
      strapi.log.info(`创建支付会话，临时订单号: ${tempOrderNumber}`);

             // 创建checkout session
       const session = await createCheckoutSession({
         orderItems,
         customerEmail,
         customerName,
         successUrl,
         cancelUrl,
         metadata: enhancedMetadata,
       });

       return ctx.send({
         success: true,
         data: {
           id: session.sessionId,
           url: session.url,
         },
       });
    } catch (error) {
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
      event = await verifyWebhookSignature(payload, signature);
      strapi.log.info('Webhook签名验证成功，事件类型:', event.type);
      
    } catch (err) {
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
      
    } catch (err) {
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