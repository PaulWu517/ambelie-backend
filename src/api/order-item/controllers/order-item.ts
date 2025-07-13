import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::order-item.order-item', ({ strapi }) => ({
  
  // 创建订单项
  async create(ctx) {
    try {
      const { data } = ctx.request.body;
      
      // 验证必需字段
      if (!data.product || !data.order || !data.quantity || !data.unitPrice) {
        return ctx.badRequest('缺少必需字段：product, order, quantity, unitPrice');
      }
      
      // 计算总价
      if (!data.totalPrice) {
        data.totalPrice = data.quantity * data.unitPrice;
      }
      
      // 获取产品信息作为快照
      if (!data.productSnapshot) {
        const product = await strapi.entityService.findOne('api::product.product', data.product);
        if (product) {
          // 创建产品快照，保存当前产品的关键信息
          data.productSnapshot = {
            id: product.id,
            name: product.name || '',
            price: product.price || 0,
            description: product.description || '',
            // 只包含存在的字段
            ...(product.slug && { slug: product.slug }),
            ...(product.dimensions && { dimensions: product.dimensions }),
            ...(product.period && { period: product.period }),
            ...(product.origin && { origin: product.origin }),
            ...(product.materials && { materials: product.materials }),
          };
        }
      }
      
      const orderItem = await strapi.entityService.create('api::order-item.order-item', {
        data,
        populate: ['product', 'order'],
      });
      
      return ctx.send({
        success: true,
        data: orderItem,
      });
    } catch (error) {
      strapi.log.error('创建订单项失败:', error);
      return ctx.internalServerError('创建订单项失败');
    }
  },
  
  // 获取订单的所有项目
  async findByOrder(ctx) {
    try {
      const { orderId } = ctx.params;
      
      const orderItems = await strapi.entityService.findMany('api::order-item.order-item', {
        filters: { order: orderId },
        populate: ['product', 'order'],
      });
      
      return ctx.send({
        success: true,
        data: orderItems,
      });
    } catch (error) {
      strapi.log.error('获取订单项失败:', error);
      return ctx.internalServerError('获取订单项失败');
    }
  },
  
  // 更新订单项
  async update(ctx) {
    try {
      const { id } = ctx.params;
      const { data } = ctx.request.body;
      
      // 如果更新了数量或单价，重新计算总价
      if (data.quantity !== undefined || data.unitPrice !== undefined) {
        const currentItem = await strapi.entityService.findOne('api::order-item.order-item', id);
        if (currentItem) {
          const quantity = data.quantity !== undefined ? data.quantity : currentItem.quantity;
          const unitPrice = data.unitPrice !== undefined ? data.unitPrice : currentItem.unitPrice;
          data.totalPrice = quantity * unitPrice;
        }
      }
      
      const orderItem = await strapi.entityService.update('api::order-item.order-item', id, {
        data,
        populate: ['product', 'order'],
      });
      
      return ctx.send({
        success: true,
        data: orderItem,
      });
    } catch (error) {
      strapi.log.error('更新订单项失败:', error);
      return ctx.internalServerError('更新订单项失败');
    }
  },
  
})); 