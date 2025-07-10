import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::order.order', ({ strapi }) => ({
  
  // 创建订单
  async create(ctx) {
    try {
      const requestData = ctx.request.body?.data || ctx.request.body;
      
      // 准备订单数据
      const orderData = {
        ...requestData,
        // 生成唯一订单号
        orderNumber: requestData.orderNumber || `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        // 设置订单日期
        orderDate: requestData.orderDate || new Date().toISOString(),
        // 确保状态有默认值
        status: requestData.status || 'pending',
      };
      
      const order = await strapi.entityService.create('api::order.order', {
        data: orderData,
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
      const requestBody = ctx.request.body;
      const status = requestBody?.status || requestBody?.data?.status;
      
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
  
})); 