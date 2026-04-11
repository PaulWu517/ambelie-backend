export default () => {
  // 新增：规范化 CDN 域名，确保包含协议且无尾斜杠
  const normalizeBaseOrigin = (domain?: string) => {
    if (!domain) return '';
    let d = domain.trim();
    if (d.endsWith('/')) d = d.slice(0, -1);
    if (!/^https?:\/\//i.test(d)) d = `https://${d}`;
    return d;
  };
  const RAW_CDN = process.env.TENCENT_COS_CDN_DOMAIN;
  const BASE_ORIGIN = normalizeBaseOrigin(RAW_CDN) || `https://${process.env.TENCENT_COS_BUCKET}.cos.${process.env.TENCENT_COS_REGION}.myqcloud.com`;

  // 调试信息：打印腾讯云COS配置
  console.log('=== 腾讯云COS配置调试信息 ===');
  console.log('SecretId:', process.env.TENCENT_COS_SECRET_ID ? '已设置' : '未设置');
  console.log('SecretKey:', process.env.TENCENT_COS_SECRET_KEY ? '已设置' : '未设置');
  console.log('Bucket:', process.env.TENCENT_COS_BUCKET);
  console.log('Region:', process.env.TENCENT_COS_REGION);
  console.log('CDN Domain (raw):', RAW_CDN || '未设置');
  console.log('BaseOrigin (final):', BASE_ORIGIN);
  console.log('================================');

  return {
    upload: {
      config: {
        // 使用官方 AWS S3 插件代理腾讯云 COS
        provider: '@strapi/provider-upload-aws-s3',
        providerOptions: {
          s3Options: {
            credentials: {
              accessKeyId: process.env.TENCENT_COS_SECRET_ID,
              secretAccessKey: process.env.TENCENT_COS_SECRET_KEY,
            },
            region: process.env.TENCENT_COS_REGION,
            endpoint: `https://cos.${process.env.TENCENT_COS_REGION}.myqcloud.com`, // 腾讯云 COS 的 Endpoint 格式
            params: {
              Bucket: process.env.TENCENT_COS_BUCKET,
            },
          },
          baseUrl: BASE_ORIGIN, // CDN 域名，替代默认的 S3 链接
          rootPath: 'uploads', // 可选：指定存放的子目录
        },
        actionOptions: {
          upload: {},
          uploadStream: {},
          delete: {},
        },
        sizeLimit: 200 * 1024 * 1024, // 200MB
        // 平衡性能与管理端预览：恢复 thumbnail，并保留 medium/small
        breakpoints: {
          thumbnail: 245,
          medium: 900,
          small: 500,
        },
      },
    },
    'users-permissions': {
      config: {
        jwt: {
          expiresIn: '7d',
        },
        ratelimit: {
          interval: 60000,
          max: 10,
        },
      },
      enabled: true,
    },
  };
};
