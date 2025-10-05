export default {
  routes: [
    {
      method: 'GET',
      path: '/cart',
      handler: 'cart.getCart',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/cart/add',
      handler: 'cart.addToCart',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/cart/update',
      handler: 'cart.updateCartItem',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/cart/remove/:productId',
      handler: 'cart.removeFromCart',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/cart/clear',
      handler: 'cart.clearCart',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/cart/sync',
      handler: 'cart.syncCart',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};