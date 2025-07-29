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

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: ['inquiryItems']
      });

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      ctx.send({
        success: true,
        data: websiteUser.inquiryItems || [],
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

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: ['inquiryItems']
      });

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      // 验证产品是否存在
      const product = await strapi.entityService.findOne('api::product.product', productId);
      if (!product) {
        return ctx.badRequest('Product not found');
      }

      // 检查产品是否已在询价列表中
      const currentInquiryItems = websiteUser.inquiryItems || [];
      const isAlreadyInInquiry = currentInquiryItems.some(item => item.id === productId);

      if (!isAlreadyInInquiry) {
        // 添加产品到询价列表
        const updatedInquiryItems = [...currentInquiryItems.map(item => item.id), productId];
        
        await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
          data: {
            inquiryItems: updatedInquiryItems
          }
        });
      }

      // 重新获取更新后的数据
      const updatedUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: ['inquiryItems']
      });

      ctx.send({
        success: true,
        message: 'Product added to inquiry list successfully',
        data: updatedUser.inquiryItems || []
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

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: ['inquiryItems']
      });

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      // 从询价列表中移除产品
      const currentInquiryItems = websiteUser.inquiryItems || [];
      const updatedInquiryItems = currentInquiryItems
        .filter(item => item.id !== parseInt(productId))
        .map(item => item.id);

      // 更新用户询价列表
      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: { inquiryItems: updatedInquiryItems }
      });

      // 重新获取更新后的数据
      const updatedUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: ['inquiryItems']
      });

      ctx.send({
        success: true,
        message: 'Product removed from inquiry list successfully',
        data: updatedUser.inquiryItems || []
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
        data: { inquiryItems: { set: [] } }
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

      const { inquirySlugs } = ctx.request.body;
      console.log('🔄 [Inquiry Sync] Received inquiry slugs:', inquirySlugs);

      if (!Array.isArray(inquirySlugs)) {
        return ctx.badRequest('Inquiry slugs must be an array');
      }

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: ['inquiryItems']
      });

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      // 根据slug查找产品并获取其ID
      const validProductIds = [];
      for (const slug of inquirySlugs) {
        if (!slug) {
          console.warn('⚠️ [Inquiry Sync] Empty slug found, skipping');
          continue;
        }
        
        const products = await strapi.entityService.findMany('api::product.product', {
          filters: { slug: slug }
        });
        
        if (products && products.length > 0) {
          validProductIds.push(products[0].id);
          console.log(`✅ [Inquiry Sync] Found product for slug ${slug}: ID ${products[0].id}`);
        } else {
          console.warn(`⚠️ [Inquiry Sync] Product not found for slug: ${slug}`);
        }
      }

      console.log('📋 [Inquiry Sync] Valid product IDs:', validProductIds);

      // 合并本地询价列表和后端询价列表
      const currentInquiryItems = websiteUser.inquiryItems || [];
      const currentProductIds = currentInquiryItems.map(item => item.id);
      
      // 合并去重
      const mergedProductIds = [...new Set([...currentProductIds, ...validProductIds])];

      // 更新用户询价列表
      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: { inquiryItems: mergedProductIds }
      });

      // 重新获取更新后的数据
      const updatedUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: ['inquiryItems']
      });

      ctx.send({
        success: true,
        message: 'Inquiry list synced successfully',
        data: updatedUser.inquiryItems || []
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

      // 将当前询价保存到历史记录，并清空当前询价列表
      const currentInquiries = (websiteUser.inquiries as any[]) || [];
      const newInquiryRecord = {
        submittedAt: new Date().toISOString(),
        customerInfo: {
          email,
          firstName,
          lastName,
          phone,
          message
        },
        products: products.map(p => ({
          id: p.id,
          name: p.name,
          slug: p.slug
        }))
      };
      
      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: { 
          inquiries: [...currentInquiries, newInquiryRecord],
          inquiryItems: { set: [] } // 清空当前询价列表
        }
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