import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::website-user.website-user', ({ strapi }) => ({
  // 邮箱验证登录/注册
  async verifyEmailLogin(ctx) {
    try {
      console.log('=== Website User API Called ===');
      console.log('Request body:', ctx.request.body);
      
      // 检查必要的服务是否可用
      if (!strapi || !strapi.query || !strapi.service) {
        console.error('Strapi instance or services not available');
        return ctx.internalServerError('Server configuration error');
      }
      
      const { email, code, name } = ctx.request.body;

      if (!email || !code) {
        console.log('Missing email or code');
        return ctx.badRequest('Email and verification code are required');
      }

      const lowercaseEmail = email.toLowerCase();
      console.log('Processing user:', lowercaseEmail);
      
      // 测试数据库连接和content-type
      try {
        const testQuery = await strapi.query('api::website-user.website-user').findMany({
          limit: 1
        });
        console.log('Database connection test successful, found users:', testQuery.length);
      } catch (testError) {
        console.error('Database connection test failed:', testError.message);
        return ctx.internalServerError('Database connection failed', { error: testError.message });
      }
      
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
          try {
            // 使用entityService创建用户（推荐方式）
            websiteUser = await strapi.entityService.create('api::website-user.website-user', {
            data: {
              email: lowercaseEmail,
              name: name || email.split('@')[0],
              firstName: name || email.split('@')[0],
              isActive: true,
              isEmailVerified: true,
              lastLoginAt: new Date(),
              source: 'email_verification',
            }
          });
            console.log('New user created successfully:', websiteUser?.id);
            console.log('Created user object:', JSON.stringify(websiteUser, null, 2));
          } catch (createError) {
            console.error('Failed to create user:', createError);
            console.error('Create error details:', createError.stack);
            throw createError;
          }
        } else {
          // 更新现有用户
          console.log('Updating existing user...');
          const updateData: any = {
            lastLoginAt: new Date()
          };
          if (name && name !== websiteUser.name) {
            updateData.name = name;
          }
          try {
            // 使用entityService更新用户（推荐方式）
            websiteUser = await strapi.entityService.update('api::website-user.website-user', websiteUser.id, {
            data: updateData
          });
            console.log('User updated successfully:', websiteUser?.id);
            console.log('Updated user object:', JSON.stringify(websiteUser, null, 2));
          } catch (updateError) {
            console.error('Failed to update user:', updateError);
            console.error('Update error details:', updateError.stack);
            throw updateError;
          }
        }

        // 确保websiteUser不为null
        if (!websiteUser || !websiteUser.id) {
          console.error('WebsiteUser is null or missing id after create/update operation');
          throw new Error('Failed to create or update user - user object is null');
        }

        // 生成用户token
        console.log('Generating token for user:', websiteUser.id);
        let token;
        try {
          token = strapi.service('api::website-user.website-user').generateUserToken(websiteUser);
          console.log('Token generated successfully for user:', websiteUser.id);
        } catch (tokenError) {
          console.error('Failed to generate token:', tokenError);
          throw new Error('Failed to generate user token');
        }

        // 设置cookie - 添加详细调试信息
        const cookieOptions = {
          httpOnly: false, // 允许前端JavaScript访问
          secure: process.env.NODE_ENV === 'production', // 生产环境使用HTTPS
          sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'strict' | 'lax' | 'none', // 跨域支持
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
        };
        
        console.log('=== Cookie设置调试信息 ===');
        console.log('环境:', process.env.NODE_ENV);
        console.log('Cookie选项:', cookieOptions);
        console.log('Token长度:', token?.length);
        console.log('请求来源:', ctx.request.headers.origin);
        console.log('User-Agent:', ctx.request.headers['user-agent']);
        
        try {
          ctx.cookies.set('website-user-token', token, cookieOptions);
          console.log('✅ Cookie设置成功');
          
          // 验证cookie是否被设置
          const setCookieHeader = ctx.response.headers['set-cookie'];
          console.log('Set-Cookie头:', setCookieHeader);
        } catch (cookieError) {
          console.error('❌ Cookie设置失败:', cookieError);
        }

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
      const userInfo = await strapi.service('api::website-user.website-user').verifyUserToken(token);

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
      const userInfo = await strapi.service('api::website-user.website-user').verifyUserToken(token);

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