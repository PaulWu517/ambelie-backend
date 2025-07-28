export default {
  routes: [
    {
      method: 'GET',
      path: '/wishlist',
      handler: 'wishlist.getWishlist',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/wishlist/add',
      handler: 'wishlist.addToWishlist',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/wishlist/remove/:productId',
      handler: 'wishlist.removeFromWishlist',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/wishlist/clear',
      handler: 'wishlist.clearWishlist',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/wishlist/sync',
      handler: 'wishlist.syncWishlist',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/wishlist/check/:productId',
      handler: 'wishlist.checkWishlistStatus',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};