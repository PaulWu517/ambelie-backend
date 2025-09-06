export default {
  routes: [
    {
      method: 'POST',
      path: '/operation-logs/:id/restore',
      handler: 'operation-log.restore',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
        description: 'Restore an entry from a delete operation log snapshot',
        tag: { plugin: 'operation-log', name: 'Restore' }
      },
    },
  ],
};