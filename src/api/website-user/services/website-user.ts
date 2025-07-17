import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::website-user.website-user', ({ strapi }) => ({
  // 根据邮箱查找用户
  async findByEmail(email: string) {
    return await strapi.query('api::website-user.website-user').findOne({
      where: { email: email.toLowerCase() }
    });
  },

  // 创建新用户
  async createUser(userData: any) {
    return await strapi.query('api::website-user.website-user').create({
      data: {
        ...userData,
        email: userData.email.toLowerCase(),
        isActive: true,
        isEmailVerified: true,
        lastLoginAt: new Date(),
      }
    });
  },

  // 更新用户登录时间
  async updateLastLogin(userId: number) {
    return await strapi.query('api::website-user.website-user').update({
      where: { id: userId },
      data: { lastLoginAt: new Date() }
    });
  },

  // 生成用户token
  generateUserToken(user: any) {
    if (!user) {
      throw new Error('User object is null or undefined');
    }
    if (!user.id) {
      throw new Error('User object is missing id property');
    }
    if (!user.email) {
      throw new Error('User object is missing email property');
    }
    
    console.log('Generating token for user:', { id: user.id, email: user.email });
    return Buffer.from(`${user.id}:${user.email}:${Date.now()}`).toString('base64');
  },

  // 验证用户token
  verifyUserToken(token: string) {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [userId, email, timestamp] = decoded.split(':');
      
      // 检查token是否过期（7天）
      const tokenAge = Date.now() - parseInt(timestamp);
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7天
      
      if (tokenAge > maxAge) {
        return null;
      }
      
      return { userId: parseInt(userId), email };
    } catch (error) {
      return null;
    }
  }
})); 