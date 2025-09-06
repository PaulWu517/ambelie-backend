import { factories } from '@strapi/strapi';

const TECH_KEYS = new Set<string>([
  'id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt', 'createdBy', 'updatedBy',
  '__v', '__temp_key__', '__component', '__pivot', '_id'
]);

const isPrimitive = (v: any) => v == null || ['string', 'number', 'boolean'].includes(typeof v);

function pickScalars(obj: any) {
  const out: Record<string, any> = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const k of Object.keys(obj)) {
    if (TECH_KEYS.has(k)) continue;
    const v = (obj as any)[k];
    if (isPrimitive(v)) out[k] = v;
  }
  return out;
}

async function ensureUniqueSlug(strapi: any, uid: string, data: any) {
  if (!data?.slug) return data;
  const base = String(data.slug);
  let attempt = base;
  let i = 1;
  while (true) {
    const existed = await strapi.db.query(uid).findOne({ where: { slug: attempt } } as any);
    if (!existed) {
      data.slug = attempt;
      return data;
    }
    i += 1;
    attempt = `${base}-restored${i}`;
    if (i > 20) {
      data.slug = `${base}-restored-${Date.now()}`;
      return data;
    }
  }
}

export default factories.createCoreController('api::operation-log.operation-log', ({ strapi }) => ({
  async restore(ctx) {
    try {
      const secret = process.env.RESTORE_SECRET;
      const header = ctx.request.headers['x-restore-secret'];
      if (secret && header !== secret) {
        return ctx.forbidden('Forbidden');
      }

      const id = ctx.params?.id;
      if (!id) return ctx.badRequest('Missing operation log id');

      const log = await strapi.entityService.findOne('api::operation-log.operation-log', id, { populate: {} } as any);
      if (!log) return ctx.notFound('Operation log not found');
      if (log.action !== 'delete') return ctx.badRequest('Only delete logs can be restored');

      const uid: string = log.modelUid as string;
      const snapshot = (log.dataBefore || {}) as Record<string, any>;
      if (!uid || !snapshot || Object.keys(snapshot).length === 0) return ctx.badRequest('Invalid log payload');

      const ct = (strapi as any).contentTypes?.[uid];
      const isDnp = !!ct?.options?.draftAndPublish;

      // Prepare data: keep only scalar fields, restore as draft if D&P
      const data: Record<string, any> = pickScalars(snapshot);
      if (isDnp) {
        data.publishedAt = null;
      } else {
        if ('publishedAt' in data) delete (data as any).publishedAt;
      }

      await ensureUniqueSlug(strapi, uid, data);

      const created = await strapi.db.query(uid).create({ data } as any);
      ctx.body = { ok: true, uid, restoredId: created?.id, data: created };
    } catch (e: any) {
      strapi.log.error(`[RESTORE] failed: ${e?.message || e}`);
      return ctx.internalServerError('Restore failed');
    }
  },
}));