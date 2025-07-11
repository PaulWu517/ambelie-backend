/**
 * Stripe Webhook原始Body中间件
 * 根据Stripe官方文档，webhook需要接收原始的request body来验证签名
 */
export default (config, { strapi }) => {
  return async (ctx, next) => {
    // 只处理Stripe webhook端点
    if (ctx.path === '/api/payments/webhook' && ctx.method === 'POST') {
      strapi.log.info('Webhook中间件：拦截Stripe webhook请求');
      
      // 读取原始request body
      const chunks: Buffer[] = [];
      
      return new Promise((resolve, reject) => {
        ctx.req.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        
        ctx.req.on('end', async () => {
          try {
            const rawBody = Buffer.concat(chunks);
            strapi.log.info('Webhook中间件：读取原始body，长度:', rawBody.length);
            
            // 设置原始body到request对象
            ctx.request.body = rawBody;
            
            // 继续处理
            await next();
            resolve(null);
          } catch (error) {
            strapi.log.error('Webhook中间件处理错误:', error);
            reject(error);
          }
        });
        
        ctx.req.on('error', (error) => {
          strapi.log.error('Webhook中间件读取错误:', error);
          reject(error);
        });
      });
    }
    
    // 非webhook请求正常处理
    await next();
  };
}; 