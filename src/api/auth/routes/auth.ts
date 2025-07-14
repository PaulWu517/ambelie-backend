export default {
  routes: [
    {
      method: 'POST',
      path: '/auth/verify-email',
      handler: 'auth.verifyEmailCode',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/auth/me',
      handler: 'auth.me',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
}; 