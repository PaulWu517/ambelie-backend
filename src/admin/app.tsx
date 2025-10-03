import type { StrapiApp } from '@strapi/strapi/admin';

export default {
  config: {
    locales: ['zh'],
    translations: {
      zh: {
        'Auth.form.welcome.title': '欢迎来到 Ambelie 管理面板',
        'Auth.form.welcome.subtitle': '登录您的管理员账户',
        'app.components.LeftMenu.navbrand.title': 'Ambelie 管理面板',
      },
  },
    theme: {
      light: {},
      dark: {},
    },
  },
  register(app: StrapiApp) {
    // 注册全局自定义字段：带实时字数统计与上限的文本域
    app.customFields.register({
      name: 'word-count-textarea',
      type: 'text',
      intlLabel: {
        id: 'custom.word-count-textarea.label',
        defaultMessage: '带字数统计的文本',
      },
      intlDescription: {
        id: 'custom.word-count-textarea.description',
        defaultMessage: '实时显示字数并限制最大字数（默认100）',
      },
      components: {
        Input: async () =>
          import('./components/WordCountTextarea/Input').then((m) => ({
            // 断言为通用的 ComponentType 以避免 props 类型不匹配报错
            default: m.default as any,
          })),
      },
      options: {
        // 允许在Content-Type Builder中配置（如需要可扩展）
      },
    });

    // 注册层级分类选择器
    app.customFields.register({
      name: 'hierarchical-category-select',
      type: 'integer',
      intlLabel: {
        id: 'custom.hierarchical-category-select.label',
        defaultMessage: '层级分类选择器',
      },
      intlDescription: {
        id: 'custom.hierarchical-category-select.description',
        defaultMessage: '支持多层级展开的分类选择器',
      },
      components: {
        Input: async () =>
          import('./components/HierarchicalCategorySelect/Input').then((m) => ({
            default: m.default as any,
          })),
      },
      options: {
        // 可以在这里添加配置选项
      },
    });
  },
  bootstrap(app: StrapiApp) {
    console.log('Strapi admin app bootstrapped');
  },
};