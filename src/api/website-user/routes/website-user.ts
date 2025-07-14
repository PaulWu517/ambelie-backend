export default {
  routes: [
    {
      method: 'POST',
      path: '/website-users/verify-email-login',
      handler: 'website-user.verifyEmailLogin',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/website-users/me',
      handler: 'website-user.getUserByToken',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/website-users/profile',
      handler: 'website-user.updateProfile',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
}; 