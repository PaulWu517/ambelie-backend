import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::order-item.order-item', ({ strapi }) => ({
  
  // 计算订单项总价
  calculateTotalPrice(quantity: number, unitPrice: number): number {
    return quantity * unitPrice;
  },
  
  // 创建订单项时的额外处理
  async createOrderItem(data: any) {
    // 确保总价正确计算
    if (data.quantity && data.unitPrice) {
      data.totalPrice = this.calculateTotalPrice(data.quantity, data.unitPrice);
    }
    
    // 获取产品信息作为快照
    if (data.product && !data.productSnapshot) {
      const product = await strapi.entityService.findOne('api::product.product', data.product);
      if (product) {
        data.productSnapshot = {
          id: product.id,
          name: product.name || '',
          price: product.price || 0,
          description: product.description || '',
        };
      }
    }
    
    return await strapi.entityService.create('api::order-item.order-item', {
      data,
      populate: ['product', 'order'],
    });
  },
  
  // 更新订单总额
  async updateOrderTotal(orderId: any) {
    try {
      const orderItems = await strapi.entityService.findMany('api::order-item.order-item', {
        filters: { order: orderId },
      });
      
      const totalAmount = orderItems.reduce((sum: number, item: any) => {
        return sum + (item.totalPrice || 0);
      }, 0);
      
      await strapi.entityService.update('api::order.order', orderId, {
        data: { totalAmount },
      });
      
      return totalAmount;
    } catch (error) {
      strapi.log.error('更新订单总额失败:', error);
      throw error;
    }
  },
  
})); 