import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::website-user.website-user', ({ strapi }) => ({
  // 获取用户询价列表
  async getInquiries(ctx) {
    try {
      const authHeader = ctx.request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      const userInfo = await strapi.service('api::website-user.website-user').verifyUserToken(token);

      if (!userInfo) {
        return ctx.unauthorized('Invalid or expired token');
      }

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId);

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      ctx.send({
        success: true,
        data: websiteUser.inquiries || [],
        user: {
          id: websiteUser.id,
          email: websiteUser.email,
          name: websiteUser.name,
        },
      });
    } catch (error) {
      console.error('Get inquiries error:', error);
      return ctx.internalServerError('Failed to get inquiries');
    }
  },

  // 添加商品到询价列表
  async addToInquiry(ctx) {
    try {
      const authHeader = ctx.request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      const userInfo = await strapi.service('api::website-user.website-user').verifyUserToken(token);

      if (!userInfo) {
        return ctx.unauthorized('Invalid or expired token');
      }

      const { productId } = ctx.request.body;

      if (!productId) {
        return ctx.badRequest('Product ID is required');
      }

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId);

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      // 验证产品是否存在
      const product = await strapi.entityService.findOne('api::product.product', productId);
      if (!product) {
        return ctx.badRequest('Product not found');
      }

      let inquiries = (websiteUser.inquiries as any[]) || [];
      const existingItemIndex = inquiries.findIndex(item => item.productId === productId);

      if (existingItemIndex > -1) {
        // 更新询价时间
        inquiries[existingItemIndex].inquiryDate = new Date().toISOString();
      } else {
        // 添加新询价商品
        inquiries.push({
          productId,
          inquiryDate: new Date().toISOString()
        });
      }

      // 更新用户询价列表
      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: { inquiries }
      });

      ctx.send({
        success: true,
        message: 'Product added to inquiry list successfully',
        data: inquiries
      });
    } catch (error) {
      console.error('Add to inquiry error:', error);
      return ctx.internalServerError('Failed to add product to inquiry list');
    }
  },

  // 从询价列表移除商品
  async removeFromInquiry(ctx) {
    try {
      const authHeader = ctx.request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      const userInfo = await strapi.service('api::website-user.website-user').verifyUserToken(token);

      if (!userInfo) {
        return ctx.unauthorized('Invalid or expired token');
      }

      const { productId } = ctx.params;

      if (!productId) {
        return ctx.badRequest('Product ID is required');
      }

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId);

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      let inquiries = (websiteUser.inquiries as any[]) || [];
      inquiries = inquiries.filter(item => item.productId !== productId);

      // 更新用户询价列表
      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: { inquiries }
      });

      ctx.send({
        success: true,
        message: 'Product removed from inquiry list successfully',
        data: inquiries
      });
    } catch (error) {
      console.error('Remove from inquiry error:', error);
      return ctx.internalServerError('Failed to remove product from inquiry list');
    }
  },

  // 清空询价列表
  async clearInquiries(ctx) {
    try {
      const authHeader = ctx.request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      const userInfo = await strapi.service('api::website-user.website-user').verifyUserToken(token);

      if (!userInfo) {
        return ctx.unauthorized('Invalid or expired token');
      }

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId);

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      // 清空询价列表
      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: { inquiries: [] }
      });

      ctx.send({
        success: true,
        message: 'Inquiry list cleared successfully',
        data: []
      });
    } catch (error) {
      console.error('Clear inquiries error:', error);
      return ctx.internalServerError('Failed to clear inquiry list');
    }
  },

  // 同步本地询价列表到后端
  async syncInquiries(ctx) {
    try {
      const authHeader = ctx.request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      const userInfo = await strapi.service('api::website-user.website-user').verifyUserToken(token);

      if (!userInfo) {
        return ctx.unauthorized('Invalid or expired token');
      }

      const { inquiryItems } = ctx.request.body;

      if (!Array.isArray(inquiryItems)) {
        return ctx.badRequest('Inquiry items must be an array');
      }

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId);

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      // 验证所有产品是否存在
      for (const item of inquiryItems) {
        if (!item.productId) {
          return ctx.badRequest('All inquiry items must have a productId');
        }
        const product = await strapi.entityService.findOne('api::product.product', item.productId);
        if (!product) {
          return ctx.badRequest(`Product with ID ${item.productId} not found`);
        }
      }

      // 合并本地询价列表和后端询价列表
      let serverInquiries = (websiteUser.inquiries as any[]) || [];
      const mergedInquiries = [...serverInquiries];

      inquiryItems.forEach(localItem => {
        const existingIndex = mergedInquiries.findIndex(item => item.productId === localItem.productId);
        if (existingIndex > -1) {
          // 使用较新的时间戳
          const serverItem = mergedInquiries[existingIndex];
          const localTime = new Date(localItem.inquiryDate);
          const serverTime = new Date(serverItem.inquiryDate);
          
          if (localTime > serverTime) {
            mergedInquiries[existingIndex] = {
              ...localItem,
              inquiryDate: localItem.inquiryDate
            };
          }
        } else {
          mergedInquiries.push({
            ...localItem,
            inquiryDate: localItem.inquiryDate || new Date().toISOString()
          });
        }
      });

      // 更新用户询价列表
      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: { inquiries: mergedInquiries }
      });

      ctx.send({
        success: true,
        message: 'Inquiry list synced successfully',
        data: mergedInquiries
      });
    } catch (error) {
      console.error('Sync inquiries error:', error);
      return ctx.internalServerError('Failed to sync inquiry list');
    }
  },

  // 提交询价请求
  async submitInquiry(ctx) {
    try {
      const authHeader = ctx.request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      const userInfo = await strapi.service('api::website-user.website-user').verifyUserToken(token);

      if (!userInfo) {
        return ctx.unauthorized('Invalid or expired token');
      }

      const { 
        email, 
        firstName, 
        lastName, 
        phone, 
        message, 
        productIds 
      } = ctx.request.body;

      if (!email || !firstName || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return ctx.badRequest('Email, first name, and product IDs are required');
      }

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId);

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      // 验证所有产品是否存在
      const products = [];
      for (const productId of productIds) {
        const product = await strapi.entityService.findOne('api::product.product', productId, {
          populate: ['main_image']
        });
        if (!product) {
          return ctx.badRequest(`Product with ID ${productId} not found`);
        }
        products.push(product);
      }

      // 这里可以发送邮件通知或保存到数据库
      // 暂时只返回成功响应
      console.log('Inquiry submitted:', {
        user: {
          id: websiteUser.id,
          email: websiteUser.email
        },
        inquiry: {
          email,
          firstName,
          lastName,
          phone,
          message,
          products: products.map(p => ({ id: p.id, name: p.name }))
        }
      });

      // 可选：清空用户的询价列表
      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: { inquiries: [] }
      });

      ctx.send({
        success: true,
        message: 'Inquiry submitted successfully',
        data: {
          submittedAt: new Date().toISOString(),
          productCount: products.length
        }
      });
    } catch (error) {
      console.error('Submit inquiry error:', error);
      return ctx.internalServerError('Failed to submit inquiry');
    }
  }
}));