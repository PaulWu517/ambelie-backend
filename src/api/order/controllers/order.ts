import { factories } from '@strapi/strapi';
 
export default factories.createCoreController('api::order.order', ({ strapi }) => ({
  
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