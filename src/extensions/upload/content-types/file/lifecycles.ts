export default {
  async afterCreate(event) {
    try {
      const { result, params } = event as any;
      const id = result?.id;
      const url = result?.url;
      const name = result?.name;
      const hash = result?.hash;
      const mime = result?.mime;
      const size = result?.size;
      const formats = result?.formats || {};
      const formatKeys = Object.keys(formats);

      // 打印各格式的 URL，帮助定位缩略图是否生成
      const formatUrls = Object.fromEntries(
        Object.entries(formats).map(([k, v]: any) => [k, v?.url])
      );

      strapi.log.info(
        `Upload afterCreate -> id:${id} name:${name} mime:${mime} size:${size} hash:${hash}`
      );
      strapi.log.info(
        `Upload afterCreate -> url:${url} formats:${formatKeys.join(',') || 'none'}`
      );
      strapi.log.info(
        `Upload afterCreate -> format urls:${JSON.stringify(formatUrls)}`
      );
    } catch (err) {
      strapi.log.error('Upload afterCreate log error:', err);
    }
  },

  async afterUpdate(event) {
    try {
      const { result } = event as any;
      const id = result?.id;
      const formats = result?.formats || {};
      const formatKeys = Object.keys(formats);
      const formatUrls = Object.fromEntries(
        Object.entries(formats).map(([k, v]: any) => [k, v?.url])
      );
      strapi.log.info(
        `Upload afterUpdate -> id:${id} formats:${formatKeys.join(',') || 'none'}`
      );
      strapi.log.info(
        `Upload afterUpdate -> format urls:${JSON.stringify(formatUrls)}`
      );
    } catch (err) {
      strapi.log.error('Upload afterUpdate log error:', err);
    }
  },
};