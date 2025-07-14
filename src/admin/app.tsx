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
  bootstrap(app: StrapiApp) {
    console.log('Strapi admin app bootstrapped');
  },
}; 