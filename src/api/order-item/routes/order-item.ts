export default {
  routes: [
    // 默认CRUD路由
    {
      method: 'GET',
      path: '/order-items',
      handler: 'order-item.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/order-items/:id',
      handler: 'order-item.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/order-items',
      handler: 'order-item.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/order-items/:id',
      handler: 'order-item.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/order-items/:id',
      handler: 'order-item.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    
    // 自定义路由
    {
      method: 'GET',
      path: '/order-items/order/:orderId',
      handler: 'order-item.findByOrder',
      config: {
        auth: false, // 允许查看订单项
      },
    },
  ],
}; 