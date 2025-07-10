module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/uploads/:path*',
      handler: 'upload.serveFile',
      config: {
        auth: false,
      },
    },
  ],
}; 