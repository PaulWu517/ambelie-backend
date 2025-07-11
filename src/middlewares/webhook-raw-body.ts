import { Context, Next } from 'koa';

export default () => {
  return async (ctx: Context, next: Next) => {
    // 只处理webhook端点
    if (ctx.path === '/api/payments/webhook' && ctx.method === 'POST') {
      // 读取原始请求体
      const chunks: Buffer[] = [];
      
      await new Promise((resolve, reject) => {
        ctx.req.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        
        ctx.req.on('end', () => {
          const rawBody = Buffer.concat(chunks);
          // 将原始请求体保存到context中
          ctx.request.body = rawBody;
          resolve(void 0);
        });
        
        ctx.req.on('error', reject);
      });
    }
    
    await next();
  };
}; 