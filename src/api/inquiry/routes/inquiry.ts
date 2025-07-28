export default {
  routes: [
    {
      method: 'GET',
      path: '/inquiries',
      handler: 'inquiry.getInquiries',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/inquiries/add',
      handler: 'inquiry.addToInquiry',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/inquiries/remove/:productId',
      handler: 'inquiry.removeFromInquiry',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/inquiries/clear',
      handler: 'inquiry.clearInquiries',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/inquiries/sync',
      handler: 'inquiry.syncInquiries',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/inquiries/submit',
      handler: 'inquiry.submitInquiry',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};