import { factories } from '@strapi/strapi';

export default factories.createCoreController('plugin::users-permissions.user', ({ strapi }) => ({
  // 邮箱验证登录
  async verifyEmailCode(ctx) {
    try {
      const { email, code, name } = ctx.request.body;

      if (!email || !code) {
        return ctx.badRequest('Email and verification code are required');
      }

      // 这里你需要验证验证码的逻辑
      // 由于你的前端已经有验证码逻辑，这里直接处理用户创建/登录

      // 查找或创建用户
      let user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { email: email.toLowerCase() }
      });

      if (!user) {
        // 创建新用户
        const defaultRole = await strapi.query('plugin::users-permissions.role').findOne({
          where: { type: 'authenticated' }
        });

        user = await strapi.query('plugin::users-permissions.user').create({
          data: {
            username: email.split('@')[0],
            email: email.toLowerCase(),
            name: name || email.split('@')[0],
            confirmed: true,
            blocked: false,
            provider: 'email',
            role: defaultRole.id
          }
        });
      } else {
        // 更新用户信息（如果提供了name）
        if (name && name !== user.name) {
          user = await strapi.query('plugin::users-permissions.user').update({
            where: { id: user.id },
            data: { name }
          });
        }
      }

      // 生成JWT
      const jwt = strapi.plugins['users-permissions'].services.jwt.issue({
        id: user.id,
      });

      // 清理用户信息（移除敏感字段）
      const sanitizedUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        confirmed: user.confirmed,
        blocked: user.blocked,
        provider: user.provider,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };

      ctx.send({
        jwt,
        user: sanitizedUser,
        message: 'Login successful'
      });

    } catch (error) {
      console.error('Email verification login error:', error);
      return ctx.internalServerError('Login failed');
    }
  },

  // 获取当前用户信息
  async me(ctx) {
    try {
      if (!ctx.state.user) {
        return ctx.unauthorized('Not authenticated');
      }

      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: ctx.state.user.id },
        populate: ['role']
      });

      if (!user) {
        return ctx.notFound('User not found');
      }

      const sanitizedUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        confirmed: user.confirmed,
        blocked: user.blocked,
        provider: user.provider,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        role: user.role
      };

      ctx.send({
        user: sanitizedUser
      });

    } catch (error) {
      console.error('Get user info error:', error);
      return ctx.internalServerError('Failed to get user info');
    }
  }
})); 