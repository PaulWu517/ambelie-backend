import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::website-user.website-user', ({ strapi }) => ({
  // 获取用户购物车
  async getCart(ctx) {
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
        data: websiteUser.cart || [],
        user: {
          id: websiteUser.id,
          email: websiteUser.email,
          name: websiteUser.name,
        },
      });
    } catch (error) {
      console.error('Get cart error:', error);
      return ctx.internalServerError('Failed to get cart');
    }
  },

  // 添加商品到购物车
  async addToCart(ctx) {
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

      const { productId, quantity = 1 } = ctx.request.body;

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

      let cart = (websiteUser.cart as any[]) || [];
      const existingItemIndex = cart.findIndex(item => item.productId === productId);

      if (existingItemIndex > -1) {
        // 更新数量
        cart[existingItemIndex].quantity += quantity;
        cart[existingItemIndex].updatedAt = new Date().toISOString();
      } else {
        // 添加新商品
        cart.push({
          productId,
          quantity,
          addedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      // 更新用户购物车
      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: { cart }
      });

      ctx.send({
        success: true,
        message: 'Product added to cart successfully',
        data: cart
      });
    } catch (error) {
      console.error('Add to cart error:', error);
      return ctx.internalServerError('Failed to add product to cart');
    }
  },

  // 更新购物车商品数量
  async updateCartItem(ctx) {
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

      const { productId, quantity } = ctx.request.body;

      if (!productId || quantity === undefined) {
        return ctx.badRequest('Product ID and quantity are required');
      }

      if (quantity < 0) {
        return ctx.badRequest('Quantity must be non-negative');
      }

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId);

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      let cart = (websiteUser.cart as any[]) || [];
      
      if (quantity === 0) {
        // 移除商品
        cart = cart.filter(item => item.productId !== productId);
      } else {
        // 更新数量
        const existingItemIndex = cart.findIndex(item => item.productId === productId);
        if (existingItemIndex > -1) {
          cart[existingItemIndex].quantity = quantity;
          cart[existingItemIndex].updatedAt = new Date().toISOString();
        } else {
          return ctx.badRequest('Product not found in cart');
        }
      }

      // 更新用户购物车
      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: { cart }
      });

      ctx.send({
        success: true,
        message: 'Cart updated successfully',
        data: cart
      });
    } catch (error) {
      console.error('Update cart error:', error);
      return ctx.internalServerError('Failed to update cart');
    }
  },

  // 从购物车移除商品
  async removeFromCart(ctx) {
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

      let cart = (websiteUser.cart as any[]) || [];
      // 统一比较为字符串，避免数字与字符串不相等导致无法删除
      cart = cart.filter(item => item.productId?.toString() !== productId?.toString());

      // 更新用户购物车
      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: { cart }
      });

      ctx.send({
        success: true,
        message: 'Product removed from cart successfully',
        data: cart
      });
    } catch (error) {
      console.error('Remove from cart error:', error);
      return ctx.internalServerError('Failed to remove product from cart');
    }
  },

  // 清空购物车
  async clearCart(ctx) {
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

      // 清空购物车
      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: { cart: [] }
      });

      ctx.send({
        success: true,
        message: 'Cart cleared successfully',
        data: []
      });
    } catch (error) {
      console.error('Clear cart error:', error);
      return ctx.internalServerError('Failed to clear cart');
    }
  },

  // 同步本地购物车到后端
  async syncCart(ctx) {
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

      const { cartItems } = ctx.request.body;

      if (!Array.isArray(cartItems)) {
        return ctx.badRequest('Cart items must be an array');
      }

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId);

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      // 验证所有产品是否存在，并标准化本地购物车项
      const normalizedCart: any[] = [];
      for (const item of cartItems) {
        if (!item.productId) {
          return ctx.badRequest('All cart items must have a productId');
        }
        const product = await strapi.entityService.findOne('api::product.product', item.productId);
        if (!product) {
          return ctx.badRequest(`Product with ID ${item.productId} not found`);
        }
        const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
        normalizedCart.push({
          productId: item.productId,
          quantity,
          addedAt: item.addedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // 完全替换后端购物车为本地状态（与 wishlist 行为一致）
      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: { cart: normalizedCart }
      });

      ctx.send({
        success: true,
        message: 'Cart synced successfully',
        data: normalizedCart
      });
    } catch (error) {
      console.error('Sync cart error:', error);
      return ctx.internalServerError('Failed to sync cart');
    }
  }
}));