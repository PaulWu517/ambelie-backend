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
      
      // 使用Railway Volume进行持久化存储 (选项2 - 推荐)
      // 需要在Railway项目中添加Volume并挂载到 /app/public/uploads
      providerOptions: {
        localServer: {
          maxage: 300000
        },
      },
      // 自定义上传路径到Volume挂载点
      uploadPath: process.env.RAILWAY_VOLUME_MOUNT_PATH || './public/uploads',
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
