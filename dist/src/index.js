"use strict";
// import type { Core } from '@strapi/strapi';
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
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
                    const { result } = event;
                    const id = result === null || result === void 0 ? void 0 : result.id;
                    const url = result === null || result === void 0 ? void 0 : result.url;
                    const name = result === null || result === void 0 ? void 0 : result.name;
                    const mime = result === null || result === void 0 ? void 0 : result.mime;
                    const size = result === null || result === void 0 ? void 0 : result.size;
                    const formats = (result === null || result === void 0 ? void 0 : result.formats) || {};
                    const formatKeys = Object.keys(formats);
                    const formatUrls = Object.fromEntries(Object.entries(formats).map(([k, v]) => [k, v === null || v === void 0 ? void 0 : v.url]));
                    strapi.log.info(`Upload lifecycle afterCreate -> id:${id} name:${name} mime:${mime} size:${size}`);
                    strapi.log.info(`Upload lifecycle afterCreate -> url:${url} formats:${formatKeys.join(',') || 'none'}`);
                    strapi.log.info(`Upload lifecycle afterCreate -> format urls:${JSON.stringify(formatUrls)}`);
                }
                catch (err) {
                    strapi.log.error('Upload lifecycle afterCreate log error:', err);
                }
            },
            async afterUpdate(event) {
                try {
                    const { result } = event;
                    const id = result === null || result === void 0 ? void 0 : result.id;
                    const formats = (result === null || result === void 0 ? void 0 : result.formats) || {};
                    const formatKeys = Object.keys(formats);
                    const formatUrls = Object.fromEntries(Object.entries(formats).map(([k, v]) => [k, v === null || v === void 0 ? void 0 : v.url]));
                    strapi.log.info(`Upload lifecycle afterUpdate -> id:${id} formats:${formatKeys.join(',') || 'none'}`);
                    strapi.log.info(`Upload lifecycle afterUpdate -> format urls:${JSON.stringify(formatUrls)}`);
                }
                catch (err) {
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
                    }
                    catch (error) {
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
        if (strapi.__operationLogSubscribed) {
            // 避免开发环境热重载重复订阅导致重复记录
            return;
        }
        strapi.__operationLogSubscribed = true;
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
        const MODEL_DISPLAY_NAME = {
            'api::category.category': 'Category',
            'api::exhibition.exhibition': 'Exhibition',
            'api::press.press': 'Press',
            'api::product.product': 'Product',
            'api::project.project': 'Project',
            'api::showroom.showroom': 'Showroom',
        };
        const TECH_KEYS = new Set([
            'id', 'createdAt', 'updatedAt', 'publishedAt', '__v', '_id',
            // Strapi technical/meta fields we don't want to treat as business changes
            'createdBy', 'updatedBy', 'locale', 'localizations', 'documentId',
        ]);
        const getCtx = () => {
            var _a, _b;
            try {
                return ((_b = (_a = strapi.requestContext) === null || _a === void 0 ? void 0 : _a.get) === null || _b === void 0 ? void 0 : _b.call(_a)) || null;
            }
            catch (_) {
                return null;
            }
        };
        const actorFromCtx = (ctx) => {
            var _a;
            const user = (_a = ctx === null || ctx === void 0 ? void 0 : ctx.state) === null || _a === void 0 ? void 0 : _a.user;
            return {
                actorEmail: (user === null || user === void 0 ? void 0 : user.email) || null,
                actorName: (user === null || user === void 0 ? void 0 : user.username) || (user === null || user === void 0 ? void 0 : user.firstname) || (user === null || user === void 0 ? void 0 : user.lastname) || null,
            };
        };
        // per-request去重，避免同一次请求内重复写入同一条操作
        const seenInRequest = (ctx, key) => {
            if (!ctx)
                return false;
            ctx.state = ctx.state || {};
            const bag = (ctx.state.__audit_seen = ctx.state.__audit_seen || new Set());
            if (bag.has(key))
                return true;
            bag.add(key);
            return false;
        };
        // 全局短期去重（跨请求），用于处理“创建后立即发布”两个请求造成的瞬时重复
        const seenGlobally = (key, ttlMs = 5000) => {
            var _a;
            const now = Date.now();
            const store = ((_a = strapi).__audit_seen_global || (_a.__audit_seen_global = new Map()));
            const last = store.get(key) || 0;
            if (now - last < ttlMs)
                return true;
            // 清理过期项（简单遍历）
            if (store.size > 200) {
                for (const [k, t] of store) {
                    if (now - t >= ttlMs)
                        store.delete(k);
                }
            }
            store.set(key, now);
            return false;
        };
        const pick = (obj, keys) => {
            const out = {};
            for (const k of keys)
                out[k] = obj === null || obj === void 0 ? void 0 : obj[k];
            return out;
        };
        const sanitizeKeys = (keys) => keys.filter(k => !TECH_KEYS.has(k));
        const getEntryName = (ent) => {
            return ((ent === null || ent === void 0 ? void 0 : ent.name) || (ent === null || ent === void 0 ? void 0 : ent.title) || (ent === null || ent === void 0 ? void 0 : ent.slug) || (ent === null || ent === void 0 ? void 0 : ent.displayName) || ((ent === null || ent === void 0 ? void 0 : ent.id) != null ? String(ent.id) : ''));
        };
        // 统一的文档键：优先使用 name（便于跨版本/多次发布）、其次 slug、再次 documentId，最后回退到 id
        const getDocKey = (uid, ent, fallbackId) => {
            const key = (ent === null || ent === void 0 ? void 0 : ent.name) || (ent === null || ent === void 0 ? void 0 : ent.slug) || (ent === null || ent === void 0 ? void 0 : ent.documentId) || (fallbackId != null ? String(fallbackId) : null);
            return key || null;
        };
        const isPublishRequest = (ctx) => {
            var _a, _b;
            const url = ((_a = ctx === null || ctx === void 0 ? void 0 : ctx.request) === null || _a === void 0 ? void 0 : _a.url) || '';
            const method = (((_b = ctx === null || ctx === void 0 ? void 0 : ctx.request) === null || _b === void 0 ? void 0 : _b.method) || '').toUpperCase();
            return method === 'POST' && url.includes('/actions/publish');
        };
        async function logOperation(payload) {
            try {
                const dataWithTime = {
                    ...payload,
                    opTime: (payload === null || payload === void 0 ? void 0 : payload.opTime) || new Date().toISOString(),
                };
                await strapi.entityService.create('api::operation-log.operation-log', { data: dataWithTime });
            }
            catch (e) {
                strapi.log.error(`[AUDIT] failed to write log: ${(e === null || e === void 0 ? void 0 : e.message) || e}`);
            }
        }
        const getSingleId = (where) => {
            var _a;
            if (!where)
                return null;
            const toId = (v) => (v == null ? null : (typeof v === 'string' ? (isNaN(Number(v)) ? v : Number(v)) : v));
            if (typeof where.id === 'number' || typeof where.id === 'string')
                return toId(where.id);
            if (((_a = where.id) === null || _a === void 0 ? void 0 : _a.$in) && Array.isArray(where.id.$in))
                return toId(where.id.$in[0]);
            if (Array.isArray(where.$and) && where.$and.length && where.$and[0].id)
                return toId(where.$and[0].id);
            return null;
        };
        strapi.db.lifecycles.subscribe({
            models: AUDIT_MODELS,
            async afterCreate(event) {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
                const uid = (_a = event.model) === null || _a === void 0 ? void 0 : _a.uid;
                // 保护：如果不在目标模型或为自身模型，直接跳过
                if (!AUDIT_MODELS.includes(uid) || uid === 'api::operation-log.operation-log')
                    return;
                const result = event.result;
                const id = result === null || result === void 0 ? void 0 : result.id;
                const ctx = getCtx();
                // 对于 Draft & Publish 模型：
                // - 若是直接“已发布”的创建（publishedAt 非空），将其视为首次发布并记录 create
                // - 否则（草稿创建）跳过 afterCreate（发布时只在 afterUpdate 记录）
                try {
                    const ct = (_b = strapi.contentTypes) === null || _b === void 0 ? void 0 : _b[uid];
                    const isDNP = !!((_c = ct === null || ct === void 0 ? void 0 : ct.options) === null || _c === void 0 ? void 0 : _c.draftAndPublish);
                    if (isDNP) {
                        const createdAsPublished = (result === null || result === void 0 ? void 0 : result.publishedAt) != null || ((_e = (_d = event === null || event === void 0 ? void 0 : event.params) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.publishedAt) != null;
                        if (!createdAsPublished) {
                            strapi.log.debug(`[AUDIT] skip afterCreate for D&P draft -> ${uid}#${id}`);
                            return;
                        }
                        // D&P 且直接发布创建：按首次发布(create)或再次发布(update)记录
                        const docKeyVal = getDocKey(uid, result, id);
                        const key = `${uid}:${docKeyVal}:create`;
                        if (seenInRequest(ctx, key) || seenGlobally(key))
                            return;
                        const actor = actorFromCtx(ctx);
                        const modelName = MODEL_DISPLAY_NAME[uid] || uid;
                        let changedFields = sanitizeKeys(Object.keys(((_f = event.params) === null || _f === void 0 ? void 0 : _f.data) || {}));
                        if (changedFields.length === 0) {
                            changedFields = sanitizeKeys(Object.keys(result || {}));
                        }
                        // 基于 documentId/发布请求判断是否真的是“首次发布”，否则应视为更新（republish/替换版本）
                        const docId = (result === null || result === void 0 ? void 0 : result.documentId) || ((_h = (_g = event === null || event === void 0 ? void 0 : event.params) === null || _g === void 0 ? void 0 : _g.data) === null || _h === void 0 ? void 0 : _h.documentId) || null;
                        const createdFromPublish = isPublishRequest(ctx);
                        strapi.log.info(`[AUDIT][DBG] afterCreate(D&P publish) docId=${docId} createdFromPublish=${createdFromPublish} docKey=${docKeyVal}`);
                        let action = 'create';
                        let dataBefore = null;
                        try {
                            if (docId) {
                                const siblings = await strapi.entityService.findMany(uid, {
                                    filters: { documentId: docId, id: { $ne: id } },
                                    sort: { createdAt: 'desc' },
                                    limit: 10,
                                });
                                const prevPublished = Array.isArray(siblings)
                                    ? siblings.find((e) => (e === null || e === void 0 ? void 0 : e.publishedAt) != null)
                                    : null;
                                const latestSibling = Array.isArray(siblings) && siblings.length > 0 ? siblings[0] : null;
                                strapi.log.info(`[AUDIT][DBG] afterCreate siblings len=${Array.isArray(siblings) ? siblings.length : 0} prevPublished=${!!prevPublished} latestSiblingId=${latestSibling === null || latestSibling === void 0 ? void 0 : latestSibling.id} latestSiblingPublished=${!!(latestSibling === null || latestSibling === void 0 ? void 0 : latestSibling.publishedAt)}`);
                                // 判定规则（不再依赖 createdFromPublish）：
                                // 1) 有已发布兄弟版本 => update
                                // 2) 兄弟版本数量>1 => update（说明历史上至少经历过发布）
                                // 3) 兄弟版本数量=1 => 若该兄弟已发布则 update，否则（草稿）create
                                if (prevPublished) {
                                    action = 'update';
                                }
                                else if (Array.isArray(siblings)) {
                                    if (siblings.length > 1) {
                                        action = 'update';
                                    }
                                    else if (siblings.length === 1) {
                                        action = ((_j = siblings[0]) === null || _j === void 0 ? void 0 : _j.publishedAt) ? 'update' : 'create';
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
                                        });
                                        const hasHistory = Array.isArray(existed) && existed.length > 0;
                                        if (hasHistory) {
                                            action = 'update';
                                            strapi.log.info(`[AUDIT][DBG] afterCreate fallback -> use history logs for docKey=${docKeyVal} => action=update`);
                                        }
                                    }
                                    catch (e) {
                                        strapi.log.warn(`[AUDIT][DBG] afterCreate history lookup failed: ${(e === null || e === void 0 ? void 0 : e.message) || e}`);
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
                                        });
                                        const lastOp = Array.isArray(lastOps) && lastOps[0];
                                        const snapshot = (lastOp && lastOp.dataAfter) || (lastOp && lastOp.dataBefore) || null;
                                        if (snapshot) {
                                            baseBefore = snapshot;
                                            strapi.log.info(`[AUDIT][DBG] afterCreate baseline from opLog snapshot (opId=${(lastOp === null || lastOp === void 0 ? void 0 : lastOp.id) || 'n/a'})`);
                                        }
                                    }
                                    catch (e) {
                                        strapi.log.warn(`[AUDIT][DBG] afterCreate baseline snapshot lookup failed: ${(e === null || e === void 0 ? void 0 : e.message) || e}`);
                                    }
                                }
                                // 修复：首次发布(create)不做diff，直接记录所有业务字段
                                if (action === 'create') {
                                    changedFields = sanitizeKeys(Object.keys(result || {}));
                                    strapi.log.info(`[AUDIT][DBG] afterCreate (first publish) final changedFields: ${changedFields.join(',')}`);
                                    dataBefore = {}; // 首次发布，基线为空
                                }
                                else if (baseBefore) {
                                    // 再次发布(update)：与上一版已发布版本对比
                                    try {
                                        const keys = Array.from(new Set([
                                            ...Object.keys(baseBefore || {}),
                                            ...Object.keys(result || {}),
                                            ...changedFields,
                                        ]));
                                        strapi.log.info(`[AUDIT][DBG] afterCreate keys before filter: ${keys.join(',')}`);
                                        const filteredKeys = keys.filter(k => JSON.stringify(baseBefore[k]) !== JSON.stringify(result[k]));
                                        strapi.log.info(`[AUDIT][DBG] afterCreate keys after diff filter: ${filteredKeys.join(',')}`);
                                        changedFields = sanitizeKeys(filteredKeys);
                                        strapi.log.info(`[AUDIT][DBG] afterCreate final changedFields: ${changedFields.join(',')}`);
                                        strapi.log.info(`[AUDIT][DBG] afterCreate baseBefore.projectType: ${JSON.stringify(baseBefore === null || baseBefore === void 0 ? void 0 : baseBefore.projectType)}`);
                                        strapi.log.info(`[AUDIT][DBG] afterCreate result.projectType: ${JSON.stringify(result === null || result === void 0 ? void 0 : result.projectType)}`);
                                    }
                                    catch (e) {
                                        strapi.log.warn(`[AUDIT][DBG] afterCreate diff processing failed: ${(e === null || e === void 0 ? void 0 : e.message) || e}`);
                                    }
                                    // 确保 dataBefore 在 try-catch 外赋值
                                    try {
                                        dataBefore = pick(baseBefore, changedFields);
                                        strapi.log.info(`[AUDIT][DBG] afterCreate dataBefore keys: ${Object.keys(dataBefore || {}).join(',')}`);
                                    }
                                    catch (e) {
                                        strapi.log.warn(`[AUDIT][DBG] afterCreate pick dataBefore failed: ${(e === null || e === void 0 ? void 0 : e.message) || e}`);
                                        dataBefore = {};
                                    }
                                }
                            }
                        }
                        catch (_) { }
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
                }
                catch (_) { }
                // 非 D&P 模型：仅记录来自显式创建请求（POST）的创建
                const method = (((_k = ctx === null || ctx === void 0 ? void 0 : ctx.request) === null || _k === void 0 ? void 0 : _k.method) || '').toUpperCase();
                if (method !== 'POST') {
                    strapi.log.debug(`[AUDIT] skip afterCreate (method=${method}) -> ${uid}#${id}`);
                    return;
                }
                const docKeyVal2 = getDocKey(uid, result, id);
                const key = `${uid}:${docKeyVal2}:create`;
                if (seenInRequest(ctx, key) || seenGlobally(key))
                    return;
                const actor = actorFromCtx(ctx);
                const modelName = MODEL_DISPLAY_NAME[uid] || uid;
                let changedFields = sanitizeKeys(Object.keys(((_l = event.params) === null || _l === void 0 ? void 0 : _l.data) || {}));
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
                var _a, _b;
                const uid = (_a = event.model) === null || _a === void 0 ? void 0 : _a.uid;
                if (!AUDIT_MODELS.includes(uid))
                    return;
                const id = getSingleId((_b = event.params) === null || _b === void 0 ? void 0 : _b.where);
                if (!uid || !id)
                    return;
                try {
                    const before = await strapi.entityService.findOne(uid, id, { populate: { '*': true } });
                    const ctx = getCtx();
                    if (ctx) {
                        ctx.state = ctx.state || {};
                        ctx.state.__audit_before = ctx.state.__audit_before || {};
                        ctx.state.__audit_before[`${uid}:${id}`] = before;
                    }
                    strapi.log.debug(`[AUDIT] beforeUpdate -> ${uid}#${id}`);
                }
                catch (err) {
                    strapi.log.warn(`OperationLog beforeUpdate fetch failed for ${uid}#${id}: ${err === null || err === void 0 ? void 0 : err.message}`);
                }
            },
            async afterUpdate(event) {
                var _a, _b, _c, _d, _e, _f, _g;
                const uid = (_a = event.model) === null || _a === void 0 ? void 0 : _a.uid;
                if (!AUDIT_MODELS.includes(uid))
                    return;
                const result = event.result;
                const id = (result === null || result === void 0 ? void 0 : result.id) || getSingleId((_b = event.params) === null || _b === void 0 ? void 0 : _b.where);
                const ctx = getCtx();
                const before = (_d = (_c = ctx === null || ctx === void 0 ? void 0 : ctx.state) === null || _c === void 0 ? void 0 : _c.__audit_before) === null || _d === void 0 ? void 0 : _d[`${uid}:${id}`];
                const actor = actorFromCtx(ctx);
                const modelName = MODEL_DISPLAY_NAME[uid] || uid;
                // 只记录“发布”动作，忽略普通保存
                // 1) 通过 URL 判断是否为显式发布接口
                const publishByUrl = isPublishRequest(ctx);
                // 2) 通过数据变化判断：publishedAt 发生了变化，且结果为非空（首次发布或重新发布）
                const publishByData = !!(before && result &&
                    before.publishedAt !== result.publishedAt &&
                    result.publishedAt != null);
                // 为避免一次发布流程触发多次 update，这里仅在“最终状态”为已发布时记录一次
                const publishFinal = publishByData || (publishByUrl && (result === null || result === void 0 ? void 0 : result.publishedAt) != null);
                if (!publishFinal) {
                    strapi.log.debug(`[AUDIT] skip afterUpdate (not publish-final) -> ${uid}#${id}`);
                    return;
                }
                strapi.log.info(`[AUDIT][DBG] afterUpdate publish check firstPublish(before->result)=${!!(before && (before === null || before === void 0 ? void 0 : before.publishedAt) == null && (result === null || result === void 0 ? void 0 : result.publishedAt) != null)} publishByUrl=${publishByUrl} publishByData=${publishByData}`);
                // 发布内去重：同一次请求内同一条目只记一次（无论动作被判定为 create 还是 update）
                const docKeyVal3 = getDocKey(uid, result || before, id);
                const publishKey = `${uid}:${docKeyVal3}:publish`;
                if (seenInRequest(ctx, publishKey) || seenGlobally(publishKey))
                    return;
                // 计算业务字段的真实变化（默认基于 before 与 result）
                let changedFields = sanitizeKeys(Object.keys(((_e = event.params) === null || _e === void 0 ? void 0 : _e.data) || {}));
                // 首次发布：publishedAt 从 nullish -> 非空；否则视为发布更新
                const hasBefore = !!before;
                const firstPublish = !!(hasBefore && (before === null || before === void 0 ? void 0 : before.publishedAt) == null && (result === null || result === void 0 ? void 0 : result.publishedAt) != null);
                // 当为“首次发布”但该 documentId 早已有已发布版本（兄弟版本）时，应视为再次发布(update)
                const docId = (result === null || result === void 0 ? void 0 : result.documentId) || (before === null || before === void 0 ? void 0 : before.documentId) || ((_g = (_f = event === null || event === void 0 ? void 0 : event.params) === null || _f === void 0 ? void 0 : _f.data) === null || _g === void 0 ? void 0 : _g.documentId) || null;
                let baseBefore = before;
                let prevPublished = null;
                try {
                    if (docId) {
                        const siblings = await strapi.entityService.findMany(uid, {
                            filters: { documentId: docId, id: { $ne: id } },
                            sort: { createdAt: 'desc' },
                            limit: 10,
                        });
                        prevPublished = Array.isArray(siblings) ? siblings.find((e) => (e === null || e === void 0 ? void 0 : e.publishedAt) != null) : null;
                        strapi.log.info(`[AUDIT][DBG] afterUpdate prevPublished lookup docId=${docId} siblings len=${Array.isArray(siblings) ? siblings.length : 0} prevPublished=${!!prevPublished} firstPublish=${firstPublish}`);
                        if (prevPublished)
                            baseBefore = prevPublished;
                    }
                }
                catch (_) { }
                try {
                    if (baseBefore && result) {
                        const keys = Array.from(new Set([...Object.keys(baseBefore), ...Object.keys(result), ...changedFields]));
                        strapi.log.info(`[AUDIT][DBG] afterUpdate keys before filter: ${keys.join(',')}`);
                        const filteredKeys = keys.filter(k => JSON.stringify(baseBefore[k]) !== JSON.stringify(result[k]));
                        strapi.log.info(`[AUDIT][DBG] afterUpdate keys after diff filter: ${filteredKeys.join(',')}`);
                        changedFields = sanitizeKeys(filteredKeys);
                        strapi.log.info(`[AUDIT][DBG] afterUpdate final changedFields: ${changedFields.join(',')}`);
                        strapi.log.info(`[AUDIT][DBG] afterUpdate baseBefore.projectType: ${JSON.stringify(baseBefore === null || baseBefore === void 0 ? void 0 : baseBefore.projectType)}`);
                        strapi.log.info(`[AUDIT][DBG] afterUpdate result.projectType: ${JSON.stringify(result === null || result === void 0 ? void 0 : result.projectType)}`);
                    }
                }
                catch (_) { }
                // 动作判定
                let action = 'update';
                if (firstPublish) {
                    action = prevPublished ? 'update' : 'create';
                }
                else {
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
                var _a, _b;
                const uid = (_a = event.model) === null || _a === void 0 ? void 0 : _a.uid;
                if (!AUDIT_MODELS.includes(uid))
                    return;
                const id = getSingleId((_b = event.params) === null || _b === void 0 ? void 0 : _b.where);
                if (!uid || !id)
                    return;
                try {
                    const before = await strapi.entityService.findOne(uid, id, { populate: {} });
                    const ctx = getCtx();
                    if (ctx) {
                        ctx.state = ctx.state || {};
                        ctx.state.__audit_before = ctx.state.__audit_before || {};
                        ctx.state.__audit_before[`${uid}:${id}`] = before;
                    }
                    strapi.log.debug(`[AUDIT] beforeDelete -> ${uid}#${id}`);
                }
                catch (err) {
                    strapi.log.warn(`OperationLog beforeDelete fetch failed for ${uid}#${id}: ${err === null || err === void 0 ? void 0 : err.message}`);
                }
            },
            async afterDelete(event) {
                var _a, _b, _c, _d, _e;
                const uid = (_a = event.model) === null || _a === void 0 ? void 0 : _a.uid;
                if (!AUDIT_MODELS.includes(uid))
                    return;
                const id = getSingleId((_b = event.params) === null || _b === void 0 ? void 0 : _b.where);
                const ctx = getCtx();
                // 仅记录用户主动的 DELETE 请求，避免更新流程中的内部删除被误记
                const method = (((_c = ctx === null || ctx === void 0 ? void 0 : ctx.request) === null || _c === void 0 ? void 0 : _c.method) || '').toUpperCase();
                if (method !== 'DELETE') {
                    strapi.log.debug(`[AUDIT] skip afterDelete (method=${method}) -> ${uid}#${id}`);
                    return;
                }
                const before = (_e = (_d = ctx === null || ctx === void 0 ? void 0 : ctx.state) === null || _d === void 0 ? void 0 : _d.__audit_before) === null || _e === void 0 ? void 0 : _e[`${uid}:${id}`];
                const docKeyVal4 = getDocKey(uid, before, id);
                const key = `${uid}:${docKeyVal4}:delete`;
                if (seenInRequest(ctx, key) || seenGlobally(key))
                    return;
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
