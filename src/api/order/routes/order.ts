export default {
  routes: [
    // 默认CRUD路由
    {
      method: 'GET',
      path: '/orders',
      handler: 'order.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/orders/:id',
      handler: 'order.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/orders',
      handler: 'order.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/orders/:id',
      handler: 'order.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/orders/:id',
      handler: 'order.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    
    // 自定义订单路由
    {
      method: 'GET',
      path: '/orders/customer/:email',
      handler: 'order.findByCustomer',
      config: {
        auth: false, // 允许未登录用户查看订单（通过邮箱验证）
      },
    },
    {
      method: 'PUT',
      path: '/orders/:id/status',
      handler: 'order.updateStatus',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/orders/number/:orderNumber',
      handler: 'order.findByOrderNumber',
      config: {
        auth: false, // 允许通过订单号查看订单
      },
    },
  ],
}; 