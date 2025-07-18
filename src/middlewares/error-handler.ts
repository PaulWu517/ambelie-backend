/**
 * 全局错误处理中间件
 * 统一处理和格式化错误响应
 */

export default (config, { strapi }) => {
  return async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      // 记录错误日志
      strapi.log.error('请求处理错误:', {
        url: ctx.url,
        method: ctx.method,
        error: error.message,
        stack: error.stack,
        body: ctx.request.body,
        query: ctx.query,
      });

      // 根据错误类型设置响应
      let status = 500;
      let message = '服务器内部错误';
      let details = null;

      if (error.name === 'ValidationError') {
        status = 400;
        message = '请求数据验证失败';
        details = error.details;
      } else if (error.name === 'NotFoundError') {
        status = 404;
        message = '请求的资源不存在';
      } else if (error.name === 'UnauthorizedError') {
        status = 401;
        message = '未授权访问';
      } else if (error.name === 'ForbiddenError') {
        status = 403;
        message = '禁止访问';
      } else if (error.name === 'DatabaseError') {
        status = 503;
        message = '数据库服务不可用';
      } else if (error.status) {
        status = error.status;
        message = error.message || message;
      }

      // 设置响应
      ctx.status = status;
      ctx.body = {
        error: {
          status,
          name: error.name || 'InternalServerError',
          message,
          ...(details && { details }),
          ...(process.env.NODE_ENV === 'development' && {
            stack: error.stack,
            originalError: error.message,
          }),
          timestamp: new Date().toISOString(),
          path: ctx.path,
          method: ctx.method,
        },
      };

      // 确保响应头正确设置
      ctx.type = 'application/json';
    }
  };
};