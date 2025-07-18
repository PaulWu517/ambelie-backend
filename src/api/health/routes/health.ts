export default {
  routes: [
    {
      method: 'GET',
      path: '/health',
      handler: 'api::health.health.check',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET', 
      path: '/health/ping',
      handler: 'api::health.health.ping',
      config: {
        auth: false,
      },
    },
  ],
};