import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::website-user.website-user', ({ strapi }) => ({
  // 获取用户收藏列表
  async getWishlist(ctx) {
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
        populate: {
          wishlist: {
            populate: ['main_image', 'category']
          }
        }
      }) as any;

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      ctx.send({
        success: true,
        data: websiteUser.wishlist || [],
        user: {
          id: websiteUser.id,
          email: websiteUser.email,
          name: websiteUser.name,
        },
      });
    } catch (error) {
      console.error('Get wishlist error:', error);
      return ctx.internalServerError('Failed to get wishlist');
    }
  },

  // 添加商品到收藏列表
  async addToWishlist(ctx) {
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
        populate: {
          wishlist: true
        }
      }) as any;

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      // 验证产品是否存在
      const product = await strapi.entityService.findOne('api::product.product', productId);
      if (!product) {
        return ctx.badRequest('Product not found');
      }

      // 检查商品是否已在收藏列表中
      const existingWishlist = websiteUser.wishlist || [];
      const isAlreadyInWishlist = existingWishlist.some(item => item.id === productId);

      if (isAlreadyInWishlist) {
        return ctx.badRequest('Product is already in wishlist');
      }

      // 添加商品到收藏列表
      const updatedWishlistIds = [...existingWishlist.map(item => item.id), productId];
      
      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: {
          wishlist: updatedWishlistIds as any
        }
      });

      // 获取更新后的收藏列表
      const updatedUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: {
          wishlist: {
            populate: ['main_image', 'category']
          }
        }
      }) as any;

      ctx.send({
        success: true,
        message: 'Product added to wishlist successfully',
        data: updatedUser.wishlist || []
      });
    } catch (error) {
      console.error('Add to wishlist error:', error);
      return ctx.internalServerError('Failed to add product to wishlist');
    }
  },

  // 从收藏列表移除商品
  async removeFromWishlist(ctx) {
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
        populate: {
          wishlist: true
        }
      }) as any;

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      // 从收藏列表中移除商品
      const existingWishlist = websiteUser.wishlist || [];
      const updatedWishlistIds = existingWishlist
        .filter(item => item.id !== parseInt(productId))
        .map(item => item.id);

      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: {
          wishlist: updatedWishlistIds as any
        }
      });

      // 获取更新后的收藏列表
      const updatedUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: {
          wishlist: {
            populate: ['main_image', 'category']
          }
        }
      }) as any;

      ctx.send({
        success: true,
        message: 'Product removed from wishlist successfully',
        data: updatedUser.wishlist || []
      });
    } catch (error) {
      console.error('Remove from wishlist error:', error);
      return ctx.internalServerError('Failed to remove product from wishlist');
    }
  },

  // 清空收藏列表
  async clearWishlist(ctx) {
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

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId) as any;

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      // 清空收藏列表
      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: {
          wishlist: [] as any
        }
      });

      ctx.send({
        success: true,
        message: 'Wishlist cleared successfully',
        data: []
      });
    } catch (error) {
      console.error('Clear wishlist error:', error);
      return ctx.internalServerError('Failed to clear wishlist');
    }
  },

  // 同步本地收藏列表到后端
  async syncWishlist(ctx) {
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

      const { productIds } = ctx.request.body;

      if (!Array.isArray(productIds)) {
        return ctx.badRequest('Product IDs must be an array');
      }

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: {
          wishlist: true
        }
      }) as any;

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      // 验证所有产品是否存在
      for (const productId of productIds) {
        const product = await strapi.entityService.findOne('api::product.product', productId);
        if (!product) {
          return ctx.badRequest(`Product with ID ${productId} not found`);
        }
      }

      // 合并本地收藏列表和后端收藏列表
      const serverWishlistIds = (websiteUser.wishlist || []).map(item => item.id);
      const mergedWishlistIds = [...new Set([...serverWishlistIds, ...productIds])];

      // 更新用户收藏列表
      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: {
          wishlist: mergedWishlistIds as any
        }
      });

      // 获取更新后的收藏列表
      const updatedUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: {
          wishlist: {
            populate: ['main_image', 'category']
          }
        }
      }) as any;

      ctx.send({
        success: true,
        message: 'Wishlist synced successfully',
        data: updatedUser.wishlist || []
      });
    } catch (error) {
      console.error('Sync wishlist error:', error);
      return ctx.internalServerError('Failed to sync wishlist');
    }
  },

  // 检查商品是否在收藏列表中
  async checkWishlistStatus(ctx) {
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
        populate: {
          wishlist: true
        }
      }) as any;

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      const existingWishlist = websiteUser.wishlist || [];
      const isInWishlist = existingWishlist.some(item => item.id === parseInt(productId));

      ctx.send({
        success: true,
        data: {
          productId: parseInt(productId),
          isInWishlist
        }
      });
    } catch (error) {
      console.error('Check wishlist status error:', error);
      return ctx.internalServerError('Failed to check wishlist status');
    }
  }
}));