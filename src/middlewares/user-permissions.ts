export default (config, { strapi }) => {
  return async (ctx, next) => {
    // 允许管理员访问所有用户操作
    if (ctx.state.isAuthenticated && ctx.state.user && ctx.state.user.role && ctx.state.user.role.type === 'super_admin') {
      await next();
      return;
    }

    // 对于API路由，检查权限
    if (ctx.request.url.startsWith('/api/users-permissions/users')) {
      // 允许用户查看和更新自己的信息
      if (ctx.state.user && ctx.params.id && parseInt(ctx.params.id) === ctx.state.user.id) {
        await next();
        return;
      }
      
      // 管理员可以管理所有用户
      if (ctx.state.user && ctx.state.user.role && ctx.state.user.role.type === 'admin') {
        await next();
        return;
      }
    }

    await next();
  };
}; 