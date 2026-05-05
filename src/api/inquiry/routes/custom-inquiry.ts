export default {
  routes: [
    {
      method: 'POST',
      path: '/inquiries/similar',
      handler: 'inquiry.similar',
      config: {
        auth: false,
      },
    },
  ],
};