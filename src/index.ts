// import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }) {
    // 注册服务端自定义字段（与admin的 app.customFields.register 配套）
    // 名称需与admin端一致：global::word-count-textarea
    strapi.customFields.register({
      name: 'word-count-textarea',
      // 不指定 plugin，表示全局自定义字段，对应 schema 中的 "global::word-count-textarea"
      type: 'text',
      inputSize: {
        default: 12,
        isResizable: true,
      },
    });

    // 注册层级分类选择器
    strapi.customFields.register({
      name: 'hierarchical-category-select',
      type: 'integer',
      inputSize: {
        default: 12,
        isResizable: false,
      },
    });
  },

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
            const chunks = [];
            
            for await (const chunk of ctx.req) {
              chunks.push(chunk);
            }
            
            const rawBody = Buffer.concat(chunks);
            const signature = ctx.request.headers['stripe-signature'];
            
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
            
            // 处理事件：直接调用控制器文件内的命名导出函数，显式传入 strapi
            const {
              handleCheckoutSessionCompleted,
              handlePaymentSucceeded,
              handlePaymentFailed,
            } = require('./api/payment/controllers/payment');

            switch (event.type) {
              case 'checkout.session.completed':
                strapi.log.info('处理checkout.session.completed事件');
                await handleCheckoutSessionCompleted(event.data.object, strapi);
                break;
              case 'payment_intent.succeeded':
                strapi.log.info('处理payment_intent.succeeded事件');
                await handlePaymentSucceeded(event.data.object, strapi);
                break;
              case 'payment_intent.payment_failed':
                strapi.log.info('处理payment_intent.payment_failed事件');
                await handlePaymentFailed(event.data.object, strapi);
                break;
              default:
                strapi.log.info('未处理的事件类型:', event.type);
            }
            
            ctx.status = 200;
            ctx.body = { received: true };
            
          } catch (error) {
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
      existingMiddleware.forEach(middleware => {
        koaApp.use(middleware);
      });
      
      strapi.log.info('Stripe webhook处理器添加完成');
    });
    // ===== Operation Log: lifecycle subscription for selected models =====
    if ((strapi as any).__operationLogSubscribed) {
      // 避免开发环境热重载重复订阅导致重复记录
      return;
    }
    (strapi as any).__operationLogSubscribed = true;
    // 启动时输出一条标识日志，帮助定位终端可见性问题
    strapi.log.info('[AUDIT] Operation Log lifecycles subscribed');

    const AUDIT_MODELS = [
      'api::category.category',
      'api::exhibition.exhibition',
      'api::press.press',
      'api::product.product',
      'api::project.project',
      'api::showroom.showroom',
    ];

    const MODEL_DISPLAY_NAME: Record<string, string> = {
      'api::category.category': 'Category',
      'api::exhibition.exhibition': 'Exhibition',
      'api::press.press': 'Press',
      'api::product.product': 'Product',
      'api::project.project': 'Project',
      'api::showroom.showroom': 'Showroom',
    };

    const TECH_KEYS = new Set<string>([
      'id', 'createdAt', 'updatedAt', 'publishedAt', '__v', '_id',
      // Strapi technical/meta fields we don't want to treat as business changes
      'createdBy', 'updatedBy', 'locale', 'localizations', 'documentId',
    ]);

    const getCtx = () => {
      try {
        return (strapi as any).requestContext?.get?.() || null;
      } catch (_) {
        return null;
      }
    };

    const actorFromCtx = (ctx: any) => {
      const user = ctx?.state?.user;
      return {
        actorEmail: user?.email || null,
        actorName: user?.username || user?.firstname || user?.lastname || null,
      };
    };

    // per-request去重，避免同一次请求内重复写入同一条操作
    const seenInRequest = (ctx: any, key: string) => {
      if (!ctx) return false;
      ctx.state = ctx.state || {};
      const bag = (ctx.state.__audit_seen = ctx.state.__audit_seen || new Set<string>());
      if (bag.has(key)) return true;
      bag.add(key);
      return false;
    };

    // 全局短期去重（跨请求），用于处理“创建后立即发布”两个请求造成的瞬时重复
    const seenGlobally = (key: string, ttlMs = 5000) => {
      const now = Date.now();
      const store: Map<string, number> = ((strapi as any).__audit_seen_global ||= new Map());
      const last = store.get(key) || 0;
      if (now - last < ttlMs) return true;
      // 清理过期项（简单遍历）
      if (store.size > 200) {
        for (const [k, t] of store) {
          if (now - t >= ttlMs) store.delete(k);
        }
      }
      store.set(key, now);
      return false;
    };

    const pick = (obj: any, keys: string[]) => {
      const out: Record<string, any> = {};
      for (const k of keys) out[k] = obj?.[k];
      return out;
    };

    const sanitizeKeys = (keys: string[]) => keys.filter(k => !TECH_KEYS.has(k));

    const getEntryName = (ent: any) => {
      return (
        ent?.name || ent?.title || ent?.slug || ent?.displayName || (ent?.id != null ? String(ent.id) : '')
      );
    };

    // 统一的文档键：优先使用 name（便于跨版本/多次发布）、其次 slug、再次 documentId，最后回退到 id
    const getDocKey = (uid: string, ent: any, fallbackId?: number | string | null) => {
      const key = ent?.name || ent?.slug || ent?.documentId || (fallbackId != null ? String(fallbackId) : null);
      return key || null;
    };

    const isPublishRequest = (ctx: any) => {
      const url = ctx?.request?.url || '';
      const method = (ctx?.request?.method || '').toUpperCase();
      return method === 'POST' && url.includes('/actions/publish');
    };

    async function logOperation(payload: any) {
      try {
        const dataWithTime = {
          ...payload,
          opTime: payload?.opTime || new Date().toISOString(),
        };
        await strapi.entityService.create('api::operation-log.operation-log', { data: dataWithTime } as any);
      } catch (e) {
        strapi.log.error(`[AUDIT] failed to write log: ${e?.message || e}`);
      }
    }

    const getSingleId = (where: any) => {
      if (!where) return null;
      const toId = (v: any) => (v == null ? null : (typeof v === 'string' ? (isNaN(Number(v)) ? v : Number(v)) : v));
      if (typeof where.id === 'number' || typeof where.id === 'string') return toId(where.id);
      if (where.id?.$in && Array.isArray(where.id.$in)) return toId(where.id.$in[0]);
      if (Array.isArray(where.$and) && where.$and.length && where.$and[0].id) return toId(where.$and[0].id);
      return null;
    };

    strapi.db.lifecycles.subscribe({
      models: AUDIT_MODELS,

      async afterCreate(event) {
        const uid = (event as any).model?.uid;
        // 保护：如果不在目标模型或为自身模型，直接跳过
        if (!AUDIT_MODELS.includes(uid) || uid === 'api::operation-log.operation-log') return;
        const result = (event as any).result;
        const id = result?.id;
        const ctx = getCtx();

        // 对于 Draft & Publish 模型：
        // - 若是直接“已发布”的创建（publishedAt 非空），将其视为首次发布并记录 create
        // - 否则（草稿创建）跳过 afterCreate（发布时只在 afterUpdate 记录）
        try {
          const ct = (strapi as any).contentTypes?.[uid];
          const isDNP = !!ct?.options?.draftAndPublish;
          if (isDNP) {
            const createdAsPublished = (result as any)?.publishedAt != null || (event as any)?.params?.data?.publishedAt != null;
            if (!createdAsPublished) {
              strapi.log.debug(`[AUDIT] skip afterCreate for D&P draft -> ${uid}#${id}`);
              return;
            }
            // D&P 且直接发布创建：按首次发布(create)或再次发布(update)记录
            const docKeyVal = getDocKey(uid, result, id);
            const key = `${uid}:${docKeyVal}:create`;
            if (seenInRequest(ctx, key) || seenGlobally(key)) return;
            const actor = actorFromCtx(ctx);
            const modelName = MODEL_DISPLAY_NAME[uid] || uid;
            let changedFields = sanitizeKeys(Object.keys((event as any).params?.data || {}));
            if (changedFields.length === 0) {
              changedFields = sanitizeKeys(Object.keys(result || {}));
            }
            // 基于 documentId/发布请求判断是否真的是“首次发布”，否则应视为更新（republish/替换版本）
            const docId = (result as any)?.documentId || (event as any)?.params?.data?.documentId || null;
            const createdFromPublish = isPublishRequest(ctx);
            strapi.log.info(`[AUDIT][DBG] afterCreate(D&P publish) docId=${docId} createdFromPublish=${createdFromPublish} docKey=${docKeyVal}`);
            let action: 'create' | 'update' = 'create';
            let dataBefore: any = null;
            try {
              if (docId) {
                const siblings: any[] = await strapi.entityService.findMany(uid, {
                  filters: { documentId: docId, id: { $ne: id } },
                  sort: { createdAt: 'desc' },
                  limit: 10,
                } as any);
                const prevPublished = Array.isArray(siblings)
                  ? siblings.find((e: any) => e?.publishedAt != null)
                  : null;
                const latestSibling = Array.isArray(siblings) && siblings.length > 0 ? siblings[0] : null;
                strapi.log.info(`[AUDIT][DBG] afterCreate siblings len=${Array.isArray(siblings)?siblings.length:0} prevPublished=${!!prevPublished} latestSiblingId=${latestSibling?.id} latestSiblingPublished=${!!latestSibling?.publishedAt}`);
                // 判定规则（不再依赖 createdFromPublish）：
                // 1) 有已发布兄弟版本 => update
                // 2) 兄弟版本数量>1 => update（说明历史上至少经历过发布）
                // 3) 兄弟版本数量=1 => 若该兄弟已发布则 update，否则（草稿）create
                if (prevPublished) {
                  action = 'update';
                } else if (Array.isArray(siblings)) {
                  if (siblings.length > 1) {
                    action = 'update';
                  } else if (siblings.length === 1) {
                    action = siblings[0]?.publishedAt ? 'update' : 'create';
                  }
                }
                // 历史日志回退判定：若当前未能命中已发布兄弟，但历史上已有同 docKey 的发布记录，则视为 update
                if (action === 'create') {
                  try {
                    const existed = await strapi.entityService.findMany('api::operation-log.operation-log', {
                      filters: {
                        modelUid: uid,
                        docKey: docKeyVal,
                        action: { $in: ['create', 'update'] },
                      },
                      sort: { createdAt: 'desc' },
                      limit: 1,
                    } as any);
                    const hasHistory = Array.isArray(existed) && existed.length > 0;
                    if (hasHistory) {
                      action = 'update';
                      strapi.log.info(`[AUDIT][DBG] afterCreate fallback -> use history logs for docKey=${docKeyVal} => action=update`);
                    }
                  } catch (e) {
                    strapi.log.warn(`[AUDIT][DBG] afterCreate history lookup failed: ${e?.message || e}`);
                  }
                }
                
                // 修复：基线选择策略 - 只用已发布版本做对比，避免与草稿对比
                let baseBefore = prevPublished; // 不再使用 latestSibling 作为回退
                
                // 若未能取到已发布兄弟作为对比基线，但动作已判定为 update，则再以历史日志快照回溯基线
                if (!baseBefore && action === 'update') {
                  try {
                    const lastOps = await strapi.entityService.findMany('api::operation-log.operation-log', {
                      filters: {
                        modelUid: uid,
                        docKey: docKeyVal,
                        action: { $in: ['create', 'update'] },
                      },
                      sort: { createdAt: 'desc' },
                      limit: 1,
                    } as any);
                    const lastOp = Array.isArray(lastOps) && lastOps[0];
                    const snapshot = (lastOp && (lastOp as any).dataAfter) || (lastOp && (lastOp as any).dataBefore) || null;
                    if (snapshot) {
                      baseBefore = snapshot;
                      strapi.log.info(`[AUDIT][DBG] afterCreate baseline from opLog snapshot (opId=${lastOp?.id || 'n/a'})`);
                    }
                  } catch (e) {
                    strapi.log.warn(`[AUDIT][DBG] afterCreate baseline snapshot lookup failed: ${e?.message || e}`);
                  }
                }
                
                // 修复：首次发布(create)不做diff，直接记录所有业务字段
                if (action === 'create') {
                  changedFields = sanitizeKeys(Object.keys(result || {}));
                  strapi.log.info(`[AUDIT][DBG] afterCreate (first publish) final changedFields: ${changedFields.join(',')}`);
                  dataBefore = {}; // 首次发布，基线为空
                } else if (baseBefore) {
                  // 再次发布(update)：与上一版已发布版本对比
                  try {
                    const keys = Array.from(new Set([
                      ...Object.keys(baseBefore || {}),
                      ...Object.keys(result || {}),
                      ...changedFields,
                    ]));
                    strapi.log.info(`[AUDIT][DBG] afterCreate keys before filter: ${keys.join(',')}`);
                    const filteredKeys = keys.filter(k => JSON.stringify((baseBefore as any)[k]) !== JSON.stringify((result as any)[k]));
                    strapi.log.info(`[AUDIT][DBG] afterCreate keys after diff filter: ${filteredKeys.join(',')}`);
                    changedFields = sanitizeKeys(filteredKeys);
                    strapi.log.info(`[AUDIT][DBG] afterCreate final changedFields: ${changedFields.join(',')}`);
                    strapi.log.info(`[AUDIT][DBG] afterCreate baseBefore.projectType: ${JSON.stringify((baseBefore as any)?.projectType)}`);
                    strapi.log.info(`[AUDIT][DBG] afterCreate result.projectType: ${JSON.stringify((result as any)?.projectType)}`);
                  } catch (e) {
                    strapi.log.warn(`[AUDIT][DBG] afterCreate diff processing failed: ${e?.message || e}`);
                  }
                  // 确保 dataBefore 在 try-catch 外赋值
                  try {
                    dataBefore = pick(baseBefore, changedFields);
                    strapi.log.info(`[AUDIT][DBG] afterCreate dataBefore keys: ${Object.keys(dataBefore || {}).join(',')}`);
                  } catch (e) {
                    strapi.log.warn(`[AUDIT][DBG] afterCreate pick dataBefore failed: ${e?.message || e}`);
                    dataBefore = {};
                  }
                }
              }
            } catch (_) {}

            strapi.log.info(`[AUDIT] afterCreate(${action} via doc) -> ${uid}#${id} fields=${changedFields.join(',')}`);
            await logOperation({
              action,
              modelUid: uid,
              modelName,
              entryId: id,
              entryName: getEntryName(result),
              docKey: getDocKey(uid, result, id),
              ...actor,
              changedFields,
              ...(dataBefore ? { dataBefore } : {}),
              dataAfter: pick(result, changedFields),
            });
            return;
          }
        } catch (_) {}

        // 非 D&P 模型：仅记录来自显式创建请求（POST）的创建
        const method = (ctx?.request?.method || '').toUpperCase();
        if (method !== 'POST') {
          strapi.log.debug(`[AUDIT] skip afterCreate (method=${method}) -> ${uid}#${id}`);
          return;
        }

        const docKeyVal2 = getDocKey(uid, result, id);
        const key = `${uid}:${docKeyVal2}:create`;
        if (seenInRequest(ctx, key) || seenGlobally(key)) return;
        const actor = actorFromCtx(ctx);
        const modelName = MODEL_DISPLAY_NAME[uid] || uid;

        let changedFields = sanitizeKeys(Object.keys((event as any).params?.data || {}));
        if (changedFields.length === 0) {
          changedFields = sanitizeKeys(Object.keys(result || {}));
        }

        strapi.log.info(`[AUDIT] afterCreate -> ${uid}#${id} fields=${changedFields.join(',')}`);
        await logOperation({
          action: 'create',
          modelUid: uid,
          modelName,
          entryId: id,
          entryName: getEntryName(result),
          docKey: getDocKey(uid, result, id),
          ...actor,
          changedFields,
          dataAfter: pick(result, changedFields),
        });
      },

      async beforeUpdate(event) {
        const uid = (event as any).model?.uid;
        if (!AUDIT_MODELS.includes(uid)) return;
        const id = getSingleId((event as any).params?.where);
        if (!uid || !id) return;
        try {
          const before = await strapi.entityService.findOne(uid, id, { populate: { '*': true } });
          const ctx = getCtx();
          if (ctx) {
            ctx.state = ctx.state || {};
            ctx.state.__audit_before = ctx.state.__audit_before || {};
            ctx.state.__audit_before[`${uid}:${id}`] = before;
          }
          strapi.log.debug(`[AUDIT] beforeUpdate -> ${uid}#${id}`);
        } catch (err) {
          strapi.log.warn(`OperationLog beforeUpdate fetch failed for ${uid}#${id}: ${err?.message}`);
        }
      },

      async afterUpdate(event) {
        const uid = (event as any).model?.uid;
        if (!AUDIT_MODELS.includes(uid)) return;
        const result = (event as any).result;
        const id = result?.id || getSingleId((event as any).params?.where);
        const ctx = getCtx();
        const before = ctx?.state?.__audit_before?.[`${uid}:${id}`];
        const actor = actorFromCtx(ctx);
        const modelName = MODEL_DISPLAY_NAME[uid] || uid;

        // 只记录“发布”动作，忽略普通保存
        // 1) 通过 URL 判断是否为显式发布接口
        const publishByUrl = isPublishRequest(ctx);
        // 2) 通过数据变化判断：publishedAt 发生了变化，且结果为非空（首次发布或重新发布）
        const publishByData = !!(
          (before as any) && (result as any) &&
          (before as any).publishedAt !== (result as any).publishedAt &&
          (result as any).publishedAt != null
        );
        // 为避免一次发布流程触发多次 update，这里仅在“最终状态”为已发布时记录一次
        const publishFinal = publishByData || (publishByUrl && (result as any)?.publishedAt != null);
        if (!publishFinal) {
          strapi.log.debug(`[AUDIT] skip afterUpdate (not publish-final) -> ${uid}#${id}`);
          return;
        }
        strapi.log.info(`[AUDIT][DBG] afterUpdate publish check firstPublish(before->result)=${!!(before && (before as any)?.publishedAt == null && (result as any)?.publishedAt != null)} publishByUrl=${publishByUrl} publishByData=${publishByData}`);

        // 发布内去重：同一次请求内同一条目只记一次（无论动作被判定为 create 还是 update）
        const docKeyVal3 = getDocKey(uid, result || before, id);
        const publishKey = `${uid}:${docKeyVal3}:publish`;
        if (seenInRequest(ctx, publishKey) || seenGlobally(publishKey)) return;

        // 计算业务字段的真实变化（默认基于 before 与 result）
        let changedFields: string[] = sanitizeKeys(Object.keys((event as any).params?.data || {}));

        // 首次发布：publishedAt 从 nullish -> 非空；否则视为发布更新
        const hasBefore = !!before;
        const firstPublish = !!(
          hasBefore && (before as any)?.publishedAt == null && (result as any)?.publishedAt != null
        );

        // 当为“首次发布”但该 documentId 早已有已发布版本（兄弟版本）时，应视为再次发布(update)
        const docId = (result as any)?.documentId || (before as any)?.documentId || (event as any)?.params?.data?.documentId || null;
        let baseBefore = before;
        let prevPublished: any = null;
        try {
          if (docId) {
            const siblings: any[] = await strapi.entityService.findMany(uid, {
              filters: { documentId: docId, id: { $ne: id } },
              sort: { createdAt: 'desc' },
              limit: 10,
            } as any);
            prevPublished = Array.isArray(siblings) ? siblings.find((e: any) => e?.publishedAt != null) : null;
            strapi.log.info(`[AUDIT][DBG] afterUpdate prevPublished lookup docId=${docId} siblings len=${Array.isArray(siblings)?siblings.length:0} prevPublished=${!!prevPublished} firstPublish=${firstPublish}`);
            if (prevPublished) baseBefore = prevPublished;
          }
        } catch (_) {}

        try {
          if (baseBefore && result) {
            const keys = Array.from(new Set([...Object.keys(baseBefore), ...Object.keys(result), ...changedFields]));
            strapi.log.info(`[AUDIT][DBG] afterUpdate keys before filter: ${keys.join(',')}`);
            const filteredKeys = keys.filter(k => JSON.stringify((baseBefore as any)[k]) !== JSON.stringify((result as any)[k]));
            strapi.log.info(`[AUDIT][DBG] afterUpdate keys after diff filter: ${filteredKeys.join(',')}`);
            changedFields = sanitizeKeys(filteredKeys);
            strapi.log.info(`[AUDIT][DBG] afterUpdate final changedFields: ${changedFields.join(',')}`);
            strapi.log.info(`[AUDIT][DBG] afterUpdate baseBefore.projectType: ${JSON.stringify((baseBefore as any)?.projectType)}`);
            strapi.log.info(`[AUDIT][DBG] afterUpdate result.projectType: ${JSON.stringify((result as any)?.projectType)}`);
          }
        } catch (_) {}

        // 动作判定
        let action: 'create' | 'update' = 'update';
        if (firstPublish) {
          action = prevPublished ? 'update' : 'create';
        } else {
          action = 'update';
        }

        const dataBefore = baseBefore ? pick(baseBefore, changedFields) : null;
        const dataAfter = result ? pick(result, changedFields) : null;

        strapi.log.info(`[AUDIT] afterUpdate(${action} publish) -> ${uid}#${id} fields=${changedFields.join(',')}`);
        await logOperation({
          action,
          modelUid: uid,
          modelName,
          entryId: id,
          entryName: getEntryName(result || baseBefore),
          docKey: getDocKey(uid, result || baseBefore, id),
          ...actor,
          changedFields,
          ...(dataBefore ? { dataBefore } : {}),
          ...(dataAfter ? { dataAfter } : {}),
        });
      },

      async beforeDelete(event) {
        const uid = (event as any).model?.uid;
        if (!AUDIT_MODELS.includes(uid)) return;
        const id = getSingleId((event as any).params?.where);
        if (!uid || !id) return;
        try {
          const before = await strapi.entityService.findOne(uid, id, { populate: {} });
          const ctx = getCtx();
          if (ctx) {
            ctx.state = ctx.state || {};
            ctx.state.__audit_before = ctx.state.__audit_before || {};
            ctx.state.__audit_before[`${uid}:${id}`] = before;
          }
          strapi.log.debug(`[AUDIT] beforeDelete -> ${uid}#${id}`);
        } catch (err) {
          strapi.log.warn(`OperationLog beforeDelete fetch failed for ${uid}#${id}: ${err?.message}`);
        }
      },

      async afterDelete(event) {
        const uid = (event as any).model?.uid;
        if (!AUDIT_MODELS.includes(uid)) return;
        const id = getSingleId((event as any).params?.where);
        const ctx = getCtx();
        // 仅记录用户主动的 DELETE 请求，避免更新流程中的内部删除被误记
        const method = (ctx?.request?.method || '').toUpperCase();
        if (method !== 'DELETE') {
          strapi.log.debug(`[AUDIT] skip afterDelete (method=${method}) -> ${uid}#${id}`);
          return;
        }
        const before = ctx?.state?.__audit_before?.[`${uid}:${id}`];
        const docKeyVal4 = getDocKey(uid, before, id);
        const key = `${uid}:${docKeyVal4}:delete`;
        if (seenInRequest(ctx, key) || seenGlobally(key)) return;
        const actor = actorFromCtx(ctx);
        const modelName = MODEL_DISPLAY_NAME[uid] || uid;

        const entryName = getEntryName(before);
        const keys = sanitizeKeys(Object.keys(before || {}));
        const dataBefore = before ? pick(before, keys) : null;
 
        strapi.log.debug(`[AUDIT] afterDelete -> ${uid}#${id}`);
        await logOperation({
          action: 'delete',
          modelUid: uid,
          modelName,
          entryId: id,
          entryName,
          docKey: getDocKey(uid, before, id),
           ...actor,
           dataBefore,
           dataAfter: null,
           changedFields: keys,
        });
      },
    });
    // ===== End Operation Log lifecycles =====
  },
};
