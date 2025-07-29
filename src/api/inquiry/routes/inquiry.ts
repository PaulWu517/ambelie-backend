export default {
  routes: [
    {
      method: 'GET',
      path: '/inquiries',
      handler: 'inquiry.getInquiries',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/inquiries/add',
      handler: 'inquiry.addToInquiry',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/inquiries/remove/:productId',
      handler: 'inquiry.removeFromInquiry',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/inquiries/clear',
      handler: 'inquiry.clearInquiries',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/inquiries/sync',
      handler: 'inquiry.syncInquiries',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/inquiries/submit',
      handler: 'inquiry.submitInquiry',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};