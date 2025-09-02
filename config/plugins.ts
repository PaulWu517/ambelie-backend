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
        // 使用腾讯云COS进行文件存储
        provider: 'strapi-provider-upload-tencent-cloud-cos',
        providerOptions: {
          SecretId: process.env.TENCENT_COS_SECRET_ID,
          SecretKey: process.env.TENCENT_COS_SECRET_KEY,
          Bucket: process.env.TENCENT_COS_BUCKET,
          Region: process.env.TENCENT_COS_REGION,
          // 访问控制列表
          ACL: 'public-read',
          // 存储路径前缀
          BasePath: 'uploads/',
          // CDN域名（可选，如果配置了CDN加速）
          BaseOrigin: BASE_ORIGIN,
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
