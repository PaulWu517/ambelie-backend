export default {
  // 每天 03:30 清理超期的操作日志（> 180 天）
  '30 3 * * *': async ({ strapi }) => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 180);
      const where = { createdAt: { $lt: cutoff } } as any;
      const deleted = await strapi.db.query('api::operation-log.operation-log').deleteMany({ where });
      strapi.log.info(`OperationLog cleanup: removed ${deleted?.count ?? deleted ?? 0} logs older than ${cutoff.toISOString()}`);
    } catch (err) {
      strapi.log.error('OperationLog cleanup task failed:', err);
    }
  },
};