export default {
  routes: [
    // 默认CRUD路由
    {
      method: 'GET',
      path: '/payments',
      handler: 'payment.find',
    },
    {
      method: 'GET',
      path: '/payments/:id',
      handler: 'payment.findOne',
    },
    {
      method: 'POST',
      path: '/payments',
      handler: 'payment.create',
    },
    {
      method: 'PUT',
      path: '/payments/:id',
      handler: 'payment.update',
    },
    {
      method: 'DELETE',
      path: '/payments/:id',
      handler: 'payment.delete',
    },
  ],
}; 