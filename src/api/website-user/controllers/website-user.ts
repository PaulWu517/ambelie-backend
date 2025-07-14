import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::website-user.website-user', ({ strapi }) => ({
  // 邮箱验证登录/注册
  async verifyEmailLogin(ctx) {
    try {
      console.log('=== Website User API Called ===');
      console.log('Request body:', ctx.request.body);
      
      const { email, code, name } = ctx.request.body;

      if (!email || !code) {
        console.log('Missing email or code');
        return ctx.badRequest('Email and verification code are required');
      }

      const lowercaseEmail = email.toLowerCase();
      console.log('Processing user:', lowercaseEmail);
      
      let websiteUser;

      try {
        // 查找现有用户
        websiteUser = await strapi.query('api::website-user.website-user').findOne({
          where: { email: lowercaseEmail }
        });
        console.log('Existing user found:', !!websiteUser);

        if (!websiteUser) {
          // 创建新用户
          console.log('Creating new user...');
          websiteUser = await strapi.service('api::website-user.website-user').create({
            data: {
              email: lowercaseEmail,
              name: name || email.split('@')[0],
              firstName: name || email.split('@')[0],
              isActive: true,
              isEmailVerified: true,
              lastLoginAt: new Date(),
              source: 'email_verification',
              publishedAt: new Date(),
            }
          });
          console.log('New user created:', websiteUser.id);
        } else {
          // 更新现有用户
          console.log('Updating existing user...');
          const updateData: any = {
            lastLoginAt: new Date()
          };
          if (name && name !== websiteUser.name) {
            updateData.name = name;
          }
          websiteUser = await strapi.service('api::website-user.website-user').update(websiteUser.id, {
            data: updateData
          });
          console.log('User updated:', websiteUser.id);
        }

        const token = strapi.service('api::website-user.website-user').generateUserToken(websiteUser);
        console.log('Token generated for user:', websiteUser.id);

        ctx.send({
          success: true,
          message: 'Login successful',
          user: {
            id: websiteUser.id,
            email: websiteUser.email,
            name: websiteUser.name,
          },
          token
        });

      } catch (dbError) {
        console.error('Database operation error:', dbError);
        return ctx.internalServerError('Database operation failed', { error: dbError.message });
      }

    } catch (error) {
      console.error('Website user login error:', error);
      return ctx.internalServerError('An unexpected error occurred', { error: error.message });
    }
  },

  // 获取当前用户信息
  async getUserByToken(ctx) {
    try {
      const authHeader = ctx.request.headers.authorization;
        
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      const userInfo = strapi.service('api::website-user.website-user').verifyUserToken(token);

      if (!userInfo) {
        return ctx.unauthorized('Invalid or expired token');
      }

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId, {
        populate: ['avatar', 'orders']
      });

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

      ctx.send({ user: websiteUser });
    } catch (error) {
      console.error('Get user by token error:', error);
      return ctx.internalServerError('Failed to get user info');
    }
  },

  // 获取用户的所有订单
  async getUserOrders(ctx) {
    try {
      const authHeader = ctx.request.headers.authorization;
        
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      const userInfo = strapi.service('api::website-user.website-user').verifyUserToken(token);

      if (!userInfo) {
        return ctx.unauthorized('Invalid or expired token');
      }

      const websiteUser = await strapi.entityService.findOne('api::website-user.website-user', userInfo.userId);

      if (!websiteUser || !websiteUser.isActive) {
        return ctx.unauthorized('User not found or inactive');
      }

             // 获取用户的订单 - 通过关系和邮箱双重查询
       const orders = await strapi.entityService.findMany('api::order.order', {
         filters: {
           $or: [
             { customer: { id: websiteUser.id } }, // 通过关系关联的订单
             { customerEmail: websiteUser.email }, // 通过邮箱关联的订单
           ],
         },
        populate: {
          orderItems: {
            populate: ['product'],
          },
          payments: true,
          customer: true,
        },
        sort: { createdAt: 'desc' },
      });

      ctx.send({
        success: true,
        data: orders,
        user: {
          id: websiteUser.id,
          email: websiteUser.email,
          name: websiteUser.name,
        },
      });
    } catch (error) {
      console.error('Get user orders error:', error);
      return ctx.internalServerError('Failed to get user orders');
    }
  },

  // 更新用户信息
  async updateProfile(ctx) {
    ctx.send({ message: 'Profile update endpoint is not implemented yet.' });
  }
})); 