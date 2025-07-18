/**
 * 数据库连接检查中间件
 * 在每个请求前检查数据库连接状态
 */

export default (config, { strapi }) => {
  return async (ctx, next) => {
    // 只对API请求进行数据库检查，跳过静态资源
    if (!ctx.path.startsWith('/api/')) {
      return await next();
    }

    try {
      // 简单的数据库连接测试
      await strapi.db.connection.raw('SELECT 1');
      
      // 如果连接正常，继续处理请求
      await next();
    } catch (error) {
      strapi.log.error('数据库连接检查失败:', error);
      
      // 返回数据库连接错误
      ctx.status = 503;
      ctx.body = {
        error: {
          status: 503,
          name: 'DatabaseConnectionError',
          message: '数据库连接不可用，请稍后重试',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
      };
    }
  };
};