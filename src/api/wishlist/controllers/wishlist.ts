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
            populate: {
              main_image: {
                populate: '*'
              },
              category: true
            }
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
            populate: {
              main_image: {
                populate: '*'
              },
              category: true
            }
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
            populate: {
              main_image: {
                populate: '*'
              },
              category: true
            }
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
    console.log('🚀 syncWishlist 方法被调用了!');
    try {
      console.log('=== Wishlist Sync 调试信息 ===');
      console.log('请求头:', ctx.request.headers);
      
      const authHeader = ctx.request.headers.authorization;
      console.log('Authorization header:', authHeader);
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('❌ Missing or invalid authorization header');
        return ctx.unauthorized('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      console.log('提取的token:', token);
      console.log('Token长度:', token.length);
      
      const userInfo = await strapi.service('api::website-user.website-user').verifyUserToken(token);
      console.log('Token验证结果:', userInfo);

      if (!userInfo) {
        console.log('❌ Token验证失败');
        return ctx.unauthorized('Invalid or expired token');
      }
      
      console.log('✅ Token验证成功，用户ID:', userInfo.userId);
      
      console.log('请求体:', ctx.request.body);
      const { productSlugs } = ctx.request.body;
      console.log('提取的productSlugs:', productSlugs);
      console.log('productSlugs类型:', typeof productSlugs);
      console.log('是否为数组:', Array.isArray(productSlugs));

      if (!Array.isArray(productSlugs)) {
        console.log('❌ productSlugs不是数组');
        return ctx.badRequest('Product slugs must be an array');
      }
      
      console.log('✅ productSlugs验证通过，长度:', productSlugs.length);
      
      console.log('开始查找用户，用户ID:', userInfo.userId);
      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: {
          wishlist: true
        }
      }) as any;
      
      console.log('查找到的用户:', websiteUser ? '存在' : '不存在');
      if (websiteUser) {
        console.log('用户状态 isActive:', websiteUser.isActive);
      }

      if (!websiteUser || !websiteUser.isActive) {
        console.log('❌ 用户不存在或未激活');
        return ctx.unauthorized('User not found or inactive');
      }
      
      console.log('✅ 用户验证通过');
      
      console.log('开始根据slug查找产品，产品slugs:', productSlugs);
      
      // 根据 slug 查找产品并获取其 ID
      const products = await strapi.entityService.findMany('api::product.product', {
        filters: {
          slug: {
            $in: productSlugs
          }
        },
        fields: ['id', 'slug']
      }) as any[];
      
      console.log('找到的产品:', products);
      const validProductIds = products.map(product => product.id);
      console.log('有效的产品IDs:', validProductIds);

      // 完全替换后端收藏列表（同步本地状态到后端）
      console.log('将要设置的收藏列表IDs:', validProductIds);

      // 更新用户收藏列表
      await strapi.entityService.update('api::website-user.website-user', userInfo.userId, {
        data: {
          wishlist: validProductIds as any
        }
      });

      // 获取更新后的收藏列表
      const updatedUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: {
          wishlist: {
            populate: {
              main_image: {
                populate: '*'
              },
              category: true
            }
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