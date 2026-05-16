import { factories } from '@strapi/strapi';
 
export default factories.createCoreController('api::order.order', ({ strapi }) => ({
  
  // 获取订单列表（带分页和过滤）
  async find(ctx) {
    try {
      console.log('Orders API find method called');
      console.log('Query params:', ctx.query);
      
      // 添加默认分页限制以防止性能问题
      const { page = 1, pageSize = 25, ...filters } = ctx.query;
      
      // 限制最大页面大小
      const limitedPageSize = Math.min(parseInt(pageSize as string) || 25, 100);
      
      const orders = await strapi.entityService.findMany('api::order.order', {
        ...filters,
        start: (parseInt(page as string) - 1) * limitedPageSize,
        limit: limitedPageSize,
        populate: {
          orderItems: {
            populate: ['product'],
          },
          payments: true,
          customer: true,
        },
        sort: { createdAt: 'desc' },
      });
      
      // 获取总数用于分页
      const total = await strapi.entityService.count('api::order.order', {
        ...filters,
      });
      
      console.log(`Found ${orders.length} orders out of ${total} total`);
      
      return ctx.send({
        success: true,
        data: orders,
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
      console.error('获取订单列表失败:', error);
      strapi.log.error('获取订单列表失败:', error);
      return ctx.internalServerError('获取订单列表失败');
    }
  },
  
  // 创建订单
  async create(ctx) {
    try {
      const { data } = ctx.request.body;
      
      // 生成唯一订单号
      if (!data.orderNumber) {
        data.orderNumber = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      
      // 设置订单日期
      if (!data.orderDate) {
        data.orderDate = new Date().toISOString();
      }
      
      const order = await strapi.entityService.create('api::order.order', {
        data,
        populate: ['orderItems', 'payments'],
      });
      
      return ctx.send({
        success: true,
        data: order,
      });
    } catch (error) {
      strapi.log.error('创建订单失败:', error);
      return ctx.internalServerError('创建订单失败');
    }
  },
  
  // 处理全权运输的报价请求
  async requestQuote(ctx) {
    try {
      const { orderItems, customerEmail, customerName, customerPhone, shippingAddress, currency = 'GBP', shippingOption } = ctx.request.body;

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

      // 生成订单号
      const orderNumber = `QUOTE-${Date.now()}`;
      
      // 计算总价 (仅商品总价)
      const subtotal = orderItems.reduce((total, item) => total + (item.unitPrice * item.quantity), 0);

      // 创建订单数据
      const orderData = {
        orderNumber,
        status: 'quote_requested', // 特殊状态，表示等待报价
        totalAmount: subtotal,
        subtotal: subtotal,
        currency: currency.toUpperCase(),
        customerEmail: customerEmail || '',
        customerName: customerName || '',
        customerPhone: customerPhone || '',
        shippingAddress: shippingAddress || {},
        billingAddress: shippingAddress || {}, // 暂时复用
        orderDate: new Date().toISOString(),
        notes: `Shipping Option: ${shippingOption === 'full_service' ? 'Full-Service Shipping' : shippingOption}`,
        ...(websiteUser && { customer: websiteUser.id }),
      };
      
      strapi.log.info(`准备创建报价订单: ${orderData.orderNumber}`);

      const order = await strapi.entityService.create('api::order.order', {
        data: orderData as any,
      });

      // 创建订单项 (Order-items)
      const emailItemsList = [];
      for (const item of orderItems) {
        try {
          const product = await strapi.entityService.findOne('api::product.product', item.productId);
          
          if (product) {
            emailItemsList.push({ name: product.name, quantity: item.quantity || 1 });
            const productSnapshot = {
              id: product.id,
              name: product.name || '',
              price: product.price || 0,
              description: product.description || '',
              slug: product.slug || '',
            };

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

      strapi.log.info(`报价订单 ${order.orderNumber} 创建成功`);

      // 尝试发送邮件通知客户和客服
      try {
        const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_DEFAULT_FROM || 'hello@ambelie.com';
        
        // 邮件正文（发给客户）
        const customerEmailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Quote Request Received - AMBELIE</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@200;300;400;500;600;700&display=swap" rel="stylesheet">
          </head>
          <body style="font-family: 'Solena-Regular', 'Poppins', 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #333; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 1.8rem; font-family: 'Solena-Regular', 'Times New Roman', 'Georgia', serif; font-weight: 400; color: #ffffff;">Quote Request Received</h1>
              <div style="margin: 15px 0 0 0; text-align: center;">
                <img src="https://www.ambelie.com/assets/vi/Ambelie_whitelogo.png" alt="AMBELIE Logo" style="height: 35px; margin: 0 auto;" />
              </div>
            </div>

            <div style="background-color: #fff; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
              <p style="font-size: 1.1rem; margin-bottom: 20px; color: #333;">Dear ${customerName},</p>
              <p style="color: #333;">Thank you for requesting a delivery quote from Ambelie. We have received your request and our logistics team is now calculating a comprehensive shipping route tailored to your destination.</p>
              
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #666;">
                <h3 style="margin: 0 0 15px 0; color: #333; font-family: 'Solena-Regular', 'Times New Roman', 'Georgia', serif; font-weight: 400;">Order Details (#${orderNumber})</h3>
                <p style="margin-bottom: 5px;"><strong>Shipping To:</strong></p>
                <p style="margin-top: 0; color: #555;">
                  ${shippingAddress.line1}<br/>
                  ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.postal_code}<br/>
                  ${shippingAddress.country}
                </p>
                <p style="margin-bottom: 5px; margin-top: 15px;"><strong>Items Requested:</strong></p>
                <ul style="margin-top: 0; padding-left: 20px; color: #555;">
                  ${emailItemsList.map(item => `<li>${item.name} (x${item.quantity})</li>`).join('')}
                </ul>
                <p style="margin-bottom: 0; margin-top: 15px; border-top: 1px solid #ddd; padding-top: 10px;"><strong>Subtotal:</strong> ${currency} ${subtotal.toLocaleString()}</p>
              </div>
              
              <h3 style="color: #333; font-family: 'Solena-Regular', 'Times New Roman', 'Georgia', serif; font-weight: 400;">What Happens Next?</h3>
              <p style="color: #333;">A formal quote including shipping fees and any applicable taxes/duties will be sent to this email within 1-3 business days for your review.</p>
              <p style="color: #333;">If you have any questions in the meantime, simply reply to this email.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://www.ambelie.com/" style="display: inline-block; background-color: #555; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: 500; font-family: 'Poppins', 'Arial', sans-serif;">Visit Our Website</a>
              </div>
              
              <p style="margin-top: 30px; color: #333;">Warm regards,<br><strong>The Ambelie Team</strong></p>
              
              <!-- Email Signature -->
              <div style="margin-top: 30px; padding: 25px; background-color: #f8f8f8; border-radius: 8px;">
                <div style="margin-bottom: 20px;">
                  <div style="display: flex; align-items: center; margin-bottom: 15px;">
                    <img src="https://www.ambelie.com/assets/vi/Ambelie_VI_Logos.png" alt="AMBELIE Logo" style="height: 40px; margin-right: 15px;" />
                  </div>
                  <p style="margin: 0 0 5px 0; font-size: 0.8rem; color: #666; font-family: 'Poppins', 'Arial', sans-serif;">NO.21 KANGPING ROAD</p>
                  <p style="margin: 0 0 5px 0; font-size: 0.8rem; color: #666; font-family: 'Poppins', 'Arial', sans-serif;">SHANGHAI</p>
                  <p style="margin: 0; font-size: 0.8rem; color: #666; font-family: 'Poppins', 'Arial', sans-serif;">
                    <a href="https://www.instagram.com/ambelie_gallery" style="color: #666; text-decoration: underline; font-weight: 500;">@AMBELIE</a>
                  </p>
                </div>
                <div style="border-top: 1px solid #ddd; padding-top: 15px; text-align: center;">
                  <p style="margin: 0; font-size: 0.85rem; color: #999; font-family: 'Poppins', 'Arial', sans-serif;">This is an automated confirmation email. Please do not reply to this message.</p>
                  <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: #999; font-family: 'Poppins', 'Arial', sans-serif;">© ${new Date().getFullYear()} AMBELIE. All rights reserved.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;

        // 邮件正文（发给客服）
        const adminEmailHtml = `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #d32f2f;">New Quote Request: #${orderNumber}</h2>
            <p>A customer has requested a Full-Service Shipping Quote.</p>
            
            <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-left: 4px solid #d32f2f;">
              <p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
              <p><strong>Phone:</strong> ${customerPhone}</p>
              <p><strong>Destination:</strong> ${shippingAddress.country}, ${shippingAddress.city}</p>
              <p><strong>Subtotal:</strong> ${currency} ${subtotal}</p>
            </div>
            
            <p>Please log in to the Strapi Admin Panel to view the full order details and calculate the shipping costs.</p>
          </div>
        `;

        // 1. 发送给客户
        await strapi.plugin('email').service('email').send({
          to: customerEmail,
          subject: `Ambelie - Quote Request Received (#${orderNumber})`,
          html: customerEmailHtml,
        });

        // 2. 发送给管理员/客服
        await strapi.plugin('email').service('email').send({
          to: adminEmail,
          subject: `[ACTION REQUIRED] New Quote Request - ${orderNumber}`,
          html: adminEmailHtml,
        });

        strapi.log.info(`报价订单 ${order.orderNumber} 邮件通知已发送`);
      } catch (emailError) {
        strapi.log.error('发送报价订单邮件失败:', emailError);
        // 邮件发送失败不应该阻塞订单创建流程
      }

      return ctx.send({
        success: true,
        data: {
          orderNumber,
          status: 'quote_requested'
        },
      });
    } catch (error) {
      strapi.log.error('创建报价请求失败:', error);
      return ctx.internalServerError('创建报价请求失败');
    }
  },

  // 获取订单详情
  async findOne(ctx) {
    try {
      const { id } = ctx.params;
      
      const order = await strapi.entityService.findOne('api::order.order', id, {
        populate: {
          orderItems: {
            populate: ['product'],
          },
          payments: true,
        },
      });
      
      if (!order) {
        return ctx.notFound('订单不存在');
      }
      
      return ctx.send({
        success: true,
        data: order,
      });
    } catch (error) {
      strapi.log.error('获取订单详情失败:', error);
      return ctx.internalServerError('获取订单详情失败');
    }
  },
  
  // 获取用户订单列表
  async findByCustomer(ctx) {
    try {
      const { email } = ctx.params;
      
      if (!email) {
        return ctx.badRequest('缺少客户邮箱');
      }
      
      const orders = await strapi.entityService.findMany('api::order.order', {
        filters: {
          customerEmail: email,
        },
        populate: {
          orderItems: {
            populate: ['product'],
          },
          payments: true,
        },
        sort: { createdAt: 'desc' },
      });
      
      return ctx.send({
        success: true,
        data: orders,
      });
    } catch (error) {
      strapi.log.error('获取客户订单失败:', error);
      return ctx.internalServerError('获取客户订单失败');
    }
  },
  
  // 更新订单状态
  async updateStatus(ctx) {
    try {
      const { id } = ctx.params;
      const { status } = ctx.request.body;
      
      if (!status) {
        return ctx.badRequest('缺少订单状态');
      }
      
      const order = await strapi.entityService.update('api::order.order', id, {
        data: { status },
        populate: ['orderItems', 'payments'],
      });
      
      return ctx.send({
        success: true,
        data: order,
      });
    } catch (error) {
      strapi.log.error('更新订单状态失败:', error);
      return ctx.internalServerError('更新订单状态失败');
    }
  },
  
  // 根据订单号查找订单
  async findByOrderNumber(ctx) {
    try {
      const { orderNumber } = ctx.params;
      
      if (!orderNumber) {
        return ctx.badRequest('缺少订单号');
      }
      
      const orders = await strapi.entityService.findMany('api::order.order', {
        filters: {
          orderNumber: orderNumber,
        },
        populate: {
          orderItems: {
            populate: ['product'],
          },
          payments: true,
        },
      });
      
      if (orders.length === 0) {
        return ctx.notFound('订单不存在');
      }
      
      return ctx.send({
        success: true,
        data: orders[0],
      });
    } catch (error) {
      strapi.log.error('根据订单号查找订单失败:', error);
      return ctx.internalServerError('根据订单号查找订单失败');
    }
  },
  
  // 取消订单
  async cancelOrder(ctx) {
    try {
      const { id } = ctx.params;
      const { reason, details } = ctx.request.body;
      
      if (!reason) {
        return ctx.badRequest('缺少取消原因');
      }
      
      // 获取当前订单
      const order = await strapi.entityService.findOne('api::order.order', id, {
        populate: {
          orderItems: {
            populate: ['product'],
          },
          payments: true,
        },
      });
      
      if (!order) {
        return ctx.notFound('订单不存在');
      }
      
      // 检查订单是否可以取消
      const nonCancellableStatuses = ['shipped', 'delivered', 'completed', 'cancelled', 'refunded'];
      const orderStatus = order.status || 'pending'; // 如果status为undefined，默认为pending
      
      if (nonCancellableStatuses.includes(orderStatus)) {
        return ctx.badRequest(`订单状态为 ${orderStatus}，无法取消`);
      }
      
      // 更新订单状态为已取消
      const updatedOrder = await strapi.entityService.update('api::order.order', id, {
        data: { 
          status: 'cancelled',
          notes: `${order.notes || ''}\n取消原因: ${reason}${details ? `\n详细说明: ${details}` : ''}`.trim()
        },
        populate: {
          orderItems: {
            populate: ['product'],
          },
          payments: true,
        },
      });
      
      // 这里可以添加退款处理逻辑
      // 例如：调用支付提供商的退款API
      
      strapi.log.info(`订单 ${order.orderNumber} 已取消，原因: ${reason}`);
      
      return ctx.send({
        success: true,
        data: updatedOrder,
        message: '订单已成功取消，退款将在3-5个工作日内处理'
      });
    } catch (error) {
      strapi.log.error('取消订单失败:', error);
      return ctx.internalServerError('取消订单失败');
    }
  },

  // 修改订单
  async modifyOrder(ctx) {
    try {
      const { id } = ctx.params;
      const modifications = ctx.request.body;
      
      if (!modifications || Object.keys(modifications).length === 0) {
        return ctx.badRequest('缺少修改内容');
      }
      
      // 获取当前订单
      const order = await strapi.entityService.findOne('api::order.order', id, {
        populate: {
          orderItems: {
            populate: ['product'],
          },
          payments: true,
        },
      });
      
      if (!order) {
        return ctx.notFound('订单不存在');
      }
      
      // 检查订单是否可以修改
      const nonModifiableStatuses = ['shipped', 'delivered', 'completed', 'cancelled', 'refunded'];
      const orderStatus = order.status || 'pending'; // 如果status为undefined，默认为pending
      
      if (nonModifiableStatuses.includes(orderStatus)) {
        return ctx.badRequest(`订单状态为 ${orderStatus}，无法修改`);
      }
      
      // 过滤允许修改的字段
      const allowedFields = ['shippingAddress', 'customerPhone', 'customerEmail', 'customerName'];
      const filteredModifications = {};
      
      for (const key of allowedFields) {
        if (modifications[key] !== undefined) {
          filteredModifications[key] = modifications[key];
        }
      }
      
      if (Object.keys(filteredModifications).length === 0) {
        return ctx.badRequest('没有可修改的字段');
      }
      
      // 更新订单
      const updatedOrder = await strapi.entityService.update('api::order.order', id, {
        data: filteredModifications,
        populate: {
          orderItems: {
            populate: ['product'],
          },
          payments: true,
        },
      });
      
      strapi.log.info(`订单 ${order.orderNumber} 已修改，修改内容: ${JSON.stringify(filteredModifications)}`);
      
      return ctx.send({
        success: true,
        data: updatedOrder,
        message: '订单信息已成功更新'
      });
    } catch (error) {
      strapi.log.error('修改订单失败:', error);
      return ctx.internalServerError('修改订单失败');
    }
  },

  // 申请退款
  async requestRefund(ctx) {
    try {
      const { id } = ctx.params;
      const { reason, refundType, amount, items, details } = ctx.request.body;
      
      if (!reason || !refundType || !amount) {
        return ctx.badRequest('缺少必需的退款信息');
      }
      
      // 获取当前订单
      const order = await strapi.entityService.findOne('api::order.order', id, {
        populate: {
          orderItems: {
            populate: ['product'],
          },
          payments: true,
        },
      });
      
      if (!order) {
        return ctx.notFound('订单不存在');
      }
      
      // 检查订单是否可以申请退款
      const refundableStatuses = ['delivered', 'completed'];
      const orderStatus = order.status || 'pending'; // 如果status为undefined，默认为pending
      
      if (!refundableStatuses.includes(orderStatus)) {
        return ctx.badRequest(`订单状态为 ${orderStatus}，无法申请退款`);
      }
      
      // 验证退款金额
      if (amount > order.totalAmount) {
        return ctx.badRequest('退款金额不能超过订单总额');
      }
      
      // 创建退款申请记录 (这里可以扩展为独立的退款表)
      const refundRequest = {
        orderId: id,
        orderNumber: order.orderNumber,
        reason,
        refundType,
        amount,
        items: items || [],
        details: details || '',
        status: 'pending',
        requestDate: new Date().toISOString(),
        customerEmail: order.customerEmail,
        customerName: order.customerName,
      };
      
      // 更新订单备注
      const updatedOrder = await strapi.entityService.update('api::order.order', id, {
        data: { 
          notes: `${order.notes || ''}\n退款申请: ${reason} (${refundType} - $${amount})`.trim()
        },
        populate: {
          orderItems: {
            populate: ['product'],
          },
          payments: true,
        },
      });
      
      // 这里可以添加发送邮件通知、创建工单等逻辑
      
      strapi.log.info(`订单 ${order.orderNumber} 申请退款，类型: ${refundType}，金额: $${amount}`);
      
      return ctx.send({
        success: true,
        data: {
          order: updatedOrder,
          refundRequest,
        },
        message: '退款申请已提交，我们会在24-48小时内处理您的申请'
      });
    } catch (error) {
      strapi.log.error('申请退款失败:', error);
      return ctx.internalServerError('申请退款失败');
    }
  },
  
}));