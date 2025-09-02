// import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap({ strapi }) {
    // 订阅 upload 文件模型的生命周期日志，确保在所有环境都能看到（包括生产）
    strapi.db.lifecycles.subscribe({
      models: ['plugin::upload.file'],
      async afterCreate(event) {
        try {
          const { result } = event as any;
          const id = result?.id;
          const url = result?.url;
          const name = result?.name;
          const mime = result?.mime;
          const size = result?.size;
          const formats = result?.formats || {};
          const formatKeys = Object.keys(formats);
          const formatUrls = Object.fromEntries(
            Object.entries(formats).map(([k, v]: any) => [k, (v as any)?.url])
          );
          strapi.log.info(`Upload lifecycle afterCreate -> id:${id} name:${name} mime:${mime} size:${size}`);
          strapi.log.info(`Upload lifecycle afterCreate -> url:${url} formats:${formatKeys.join(',') || 'none'}`);
          strapi.log.info(`Upload lifecycle afterCreate -> format urls:${JSON.stringify(formatUrls)}`);
        } catch (err) {
          strapi.log.error('Upload lifecycle afterCreate log error:', err);
        }
      },
      async afterUpdate(event) {
        try {
          const { result } = event as any;
          const id = result?.id;
          const formats = result?.formats || {};
          const formatKeys = Object.keys(formats);
          const formatUrls = Object.fromEntries(
            Object.entries(formats).map(([k, v]: any) => [k, (v as any)?.url])
          );
          strapi.log.info(`Upload lifecycle afterUpdate -> id:${id} formats:${formatKeys.join(',') || 'none'}`);
          strapi.log.info(`Upload lifecycle afterUpdate -> format urls:${JSON.stringify(formatUrls)}`);
        } catch (err) {
          strapi.log.error('Upload lifecycle afterUpdate log error:', err);
        }
      },
    });

    // 新增：自动发送管理员邀请邮件
    strapi.db.lifecycles.subscribe({
      models: ['admin::user'],
      async afterCreate(event) {
        try {
          const { result } = event as any;
          const email = result?.email;
          const registrationToken = result?.registrationToken;
          const isActive = result?.isActive;

          // 仅在存在 registrationToken（通过“Invite new user”创建）且未激活时发送
          if (!registrationToken || isActive) {
            return;
          }

          // 计算 Admin 基础地址
          const host = process.env.HOST || 'localhost';
          const port = process.env.PORT || '1337';
          const serverUrl = process.env.PUBLIC_URL || process.env.SERVER_URL || `http://${host}:${port}`;
          const adminBaseUrl = process.env.ADMIN_URL || `${serverUrl}/admin`;
          const registerUrl = `${adminBaseUrl}/auth/register?registrationToken=${encodeURIComponent(registrationToken)}`;

          // 新增：可通过环境变量禁用管理员邀请邮件发送（默认禁用）
          const inviteEmailEnabled = String(process.env.ADMIN_INVITE_EMAIL_ENABLED || 'false').toLowerCase() === 'true';
          if (!inviteEmailEnabled) {
            strapi.log.info(`管理员邀请邮件功能已禁用，已生成注册链接（请手动发送） -> to:${email}`);
            strapi.log.info(`注册链接: ${registerUrl}`);
            return;
          }

          // 邮件参数
          const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
          const subject = `You've been invited to Ambelie Admin`;
          const html = `
            <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#333">
              <h2>Ambelie 管理后台邀请</h2>
              <p>您好，您已被邀请加入 Ambelie 管理后台。</p>
              <p>请点击以下链接完成账户设置：</p>
              <p><a href="${registerUrl}" target="_blank" rel="noopener">完成注册</a></p>
              <p>如果按钮无法打开，请复制以下链接到浏览器中打开：</p>
              <p style="word-break:break-all;color:#555">${registerUrl}</p>
              <hr />
              <p style="font-size:12px;color:#888">此链接仅用于首次设置您的管理员账户。</p>
            </div>`;
          const text = `您已被邀请加入 Ambelie 管理后台。请打开以下链接完成注册：\n${registerUrl}`;

          if (!email) {
            strapi.log.warn('admin::user afterCreate -> 邀请对象缺少 email，跳过发送邀请邮件');
            return;
          }

          strapi.log.info(`准备发送管理员邀请邮件 -> to:${email}`);

          // 通过 Email 插件发送
          await (strapi as any).plugin('email').service('email').send({
            to: email,
            from,
            subject,
            text,
            html,
          });

          strapi.log.info(`管理员邀请邮件已发送 -> ${email}`);
        } catch (err) {
          strapi.log.error('发送管理员邀请邮件失败:', err);
        }
      },
    });

    // 在服务器启动后添加原始的Stripe webhook处理器
    strapi.server.httpServer.on('listening', () => {
      strapi.log.info('添加Stripe webhook处理器');
      
      // 在现有中间件之前插入webhook处理器
      const koaApp = strapi.server.app;
      
      // 保存现有的中间件
      const existingMiddleware = koaApp.middleware.slice();
      
      // 清空现有中间件
      koaApp.middleware = [];
      
      // 添加我们的webhook处理器作为第一个中间件
      koaApp.use(async (ctx, next) => {
        // 只处理Stripe webhook路径
        if (ctx.path === '/api/payments/webhook' && ctx.method === 'POST') {
          strapi.log.info('Webhook处理器：拦截Stripe webhook请求');
          
          try {
            // 检查stream是否可读
            if (!ctx.req.readable) {
              strapi.log.error('Webhook处理器：stream不可读');
              ctx.status = 400;
              ctx.body = { error: 'Request stream not readable' };
              return;
            }
            
            // 读取原始body
            const chunks = [] as any[];
            
            for await (const chunk of ctx.req as any) {
              chunks.push(chunk);
            }
            
            const rawBody = Buffer.concat(chunks);
            const signature = (ctx.request.headers['stripe-signature'] as any);
            
            strapi.log.info('Webhook处理器：读取body成功，长度:', rawBody.length);
            strapi.log.info('Webhook处理器：签名存在:', !!signature);
            
            if (!signature) {
              strapi.log.error('Webhook处理器：缺少签名');
              ctx.status = 400;
              ctx.body = { error: '缺少Stripe签名' };
              return;
            }
            
            // 验证签名
            const { verifyWebhookSignature } = require('./services/stripe');
            const event = await verifyWebhookSignature(rawBody, Array.isArray(signature) ? signature[0] : signature);
            
            strapi.log.info('Webhook处理器：签名验证成功，事件类型:', event.type);
            
            // 处理事件
            const paymentController = strapi.controllers['api::payment.payment'];
            
            switch (event.type) {
              case 'checkout.session.completed':
                strapi.log.info('处理checkout.session.completed事件');
                await paymentController.handleCheckoutSessionCompleted(event.data.object);
                break;
              case 'payment_intent.succeeded':
                strapi.log.info('处理payment_intent.succeeded事件');
                await paymentController.handlePaymentSucceeded(event.data.object);
                break;
              case 'payment_intent.payment_failed':
                strapi.log.info('处理payment_intent.payment_failed事件');
                await paymentController.handlePaymentFailed(event.data.object);
                break;
              default:
                strapi.log.info('未处理的事件类型:', event.type);
            }
            
            ctx.status = 200;
            ctx.body = { received: true };
            
          } catch (error: any) {
            strapi.log.error('Webhook处理器错误:', error);
            ctx.status = 400;
            ctx.body = { error: error.message };
          }
          
          return; // 不调用next()，结束处理
        }
        
        // 其他请求正常处理
        await next();
      });
      
      // 重新添加现有中间件
      existingMiddleware.forEach((middleware: any) => {
        koaApp.use(middleware);
      });
      
      strapi.log.info('Stripe webhook处理器添加完成');
    });
  },
};
