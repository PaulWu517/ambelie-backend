import type { StrapiApp } from '@strapi/strapi/admin';

export default {
  config: {
    locales: [
      // 'ar',
      // 'fr',
      // 'cs',
      // 'de',
      // 'dk',
      // 'es',
      // 'he',
      // 'id',
      // 'it',
      // 'ja',
      // 'ko',
      // 'ms',
      // 'nl',
      // 'no',
      // 'pl',
      // 'pt-BR',
      // 'pt',
      // 'ru',
      // 'sk',
      // 'sv',
      // 'th',
      // 'tr',
      // 'uk',
      // 'vi',
      // 'zh-Hans',
      // 'zh',
    ],
    
    // 添加自定义翻译
    translations: {
      zh: {
        'Order': '订单',
        'Orders': '订单',
        'Order Item': '订单项',
        'Order Items': '订单项',
        'Payment': '支付',
        'Payments': '支付',
        'status': '状态',
        'orderNumber': '订单号',
        'totalAmount': '总金额',
        'customerEmail': '客户邮箱',
        'customerName': '客户姓名',
        'orderDate': '订单日期',
        'pending': '待处理',
        'confirmed': '已确认',
        'paid': '已支付',
        'processing': '处理中',
        'shipped': '已发货',
        'delivered': '已送达',
        'completed': '已完成',
        'cancelled': '已取消',
        'refunded': '已退款',
      },
    },
  },
  register(app: StrapiApp) {
    // 注册自定义插件或组件
    console.log('Admin app registered', app);
  },
  bootstrap(app: StrapiApp) {
    // 启动时的配置
    console.log('Admin app bootstrapped', app);
  },
}; 