export default {
  routes: [
    {
      method: 'GET',
      path: '/wishlist',
      handler: 'wishlist.getWishlist',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/wishlist/add',
      handler: 'wishlist.addToWishlist',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/wishlist/remove/:productId',
      handler: 'wishlist.removeFromWishlist',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/wishlist/clear',
      handler: 'wishlist.clearWishlist',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/wishlist/sync',
      handler: 'wishlist.syncWishlist',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/wishlist/check/:productId',
      handler: 'wishlist.checkWishlistStatus',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};