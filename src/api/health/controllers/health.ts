export default ({ strapi }) => ({
  // 健康检查端点
  async check(ctx) {
    try {
      // 检查数据库连接
      let dbStatus = 'unknown';
      let dbError = null;
      
      try {
        // 尝试执行一个简单的数据库查询
        await strapi.db.connection.raw('SELECT 1');
        dbStatus = 'connected';
      } catch (error) {
        dbStatus = 'disconnected';
        dbError = error.message;
        console.error('Database health check failed:', error);
      }

      // 检查Strapi服务状态
      const strapiStatus = strapi ? 'running' : 'stopped';
      
      // 检查环境变量
      const envCheck = {
        NODE_ENV: process.env.NODE_ENV || 'unknown',
        DATABASE_URL: !!process.env.DATABASE_URL,
        STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
        FRONTEND_URL: process.env.FRONTEND_URL || 'not_set'
      };

      // 获取系统信息
      const systemInfo = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version,
        platform: process.platform
      };

      const healthData = {
        status: dbStatus === 'connected' && strapiStatus === 'running' ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          database: {
            status: dbStatus,
            error: dbError
          },
          strapi: {
            status: strapiStatus
          }
        },
        environment: envCheck,
        system: systemInfo
      };

      // 如果数据库连接失败，返回503状态码
      if (dbStatus === 'disconnected') {
        ctx.status = 503;
      } else {
        ctx.status = 200;
      }

      ctx.send(healthData);
    } catch (error) {
      console.error('Health check error:', error);
      ctx.status = 503;
      ctx.send({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  },

  // 简单的存活检查
  async ping(ctx) {
    ctx.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Server is running'
    });
  }
});
