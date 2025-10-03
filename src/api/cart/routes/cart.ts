export default {
  routes: [
    {
      method: 'GET',
      path: '/cart',
      handler: 'cart.getCart',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/cart/add',
      handler: 'cart.addToCart',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/cart/update',
      handler: 'cart.updateCartItem',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/cart/remove/:productId',
      handler: 'cart.removeFromCart',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/cart/clear',
      handler: 'cart.clearCart',
      config: {
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