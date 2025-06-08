export default () => ({
  upload: {
    config: {
      // 如果您想使用Cloudinary (选项1)
      // provider: 'cloudinary',
      // providerOptions: {
      //   cloud_name: process.env.CLOUDINARY_NAME,
      //   api_key: process.env.CLOUDINARY_KEY,
      //   api_secret: process.env.CLOUDINARY_SECRET,
      // },
      
      // 使用Railway Volume进行持久化存储
      // Railway会将项目部署到 /app，所以 ./public/uploads 实际是 /app/public/uploads
      provider: 'local',
      providerOptions: {
        localServer: {
          maxage: 300000
        },
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
      sizeLimit: 200 * 1024 * 1024, // 200MB
      breakpoints: {
        xlarge: 1920,
        large: 1000,
        medium: 750,
        small: 500,
        xsmall: 64
      },
    },
  },
});
