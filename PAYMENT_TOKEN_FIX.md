# 支付功能Token问题分析与解决方案

## 🔍 问题分析

### 根本原因
支付功能失败的主要原因是**跨域请求和Token传递问题**：

1. **CORS配置缺失**：后端没有正确配置CORS，导致前端无法正常访问API
2. **Cookie设置问题**：后端生成token后没有正确设置cookie
3. **跨域Cookie传递**：Vercel部署后的跨域环境下cookie传递失败

### 具体表现
- 前端无法获取有效的`website-user-token`
- 支付请求时没有Authorization头
- 后端无法识别用户身份，但游客模式应该正常工作

## 🛠️ 解决方案

### 1. 后端修复

#### A. 添加CORS配置
创建 `config/cors.ts`：
```typescript
export default ({ env }) => ({
  origin: [
    env('FRONTEND_URL', 'http://localhost:3000'),
    'https://ambelie-next-app-1-1.vercel.app',
    'https://*.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  headers: [
    'Content-Type',
    'Authorization',
    'Origin',
    'Accept',
    'X-Requested-With',
    'stripe-signature'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours
});
```

#### B. 更新中间件配置
修改 `config/middlewares.ts` 使用新的CORS配置。

#### C. 修复Cookie设置
在 `website-user` 控制器中添加正确的cookie设置：
```typescript
ctx.cookies.set('website-user-token', token, {
  httpOnly: false, // 允许前端JavaScript访问
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
});
```

### 2. 环境变量配置

在Railway中添加以下环境变量：
```env
FRONTEND_URL=https://ambelie-next-app-1-1.vercel.app
NODE_ENV=production
```

### 3. 部署步骤

1. **提交代码更改**：
   ```bash
   git add .
   git commit -m "Fix CORS and token cookie issues for payment"
   git push
   ```

2. **Railway重新部署**：
   - Railway会自动检测代码更改并重新部署
   - 确保环境变量已正确设置

3. **验证修复**：
   - 测试用户登录是否设置cookie
   - 测试支付功能是否正常

## 🧪 测试验证

### 1. 检查Cookie设置
- 用户登录后检查浏览器开发者工具中的Cookie
- 应该看到 `website-user-token` cookie

### 2. 检查API请求
- 支付请求应该包含 `Authorization: Bearer <token>` 头
- 如果没有token，应该以游客模式继续

### 3. 检查CORS
- 前端请求不应该出现CORS错误
- 预检请求(OPTIONS)应该正常通过

## 🔧 故障排除

### 如果仍然无法获取token：
1. 检查Railway环境变量是否正确设置
2. 检查浏览器控制台是否有CORS错误
3. 检查Railway日志中的错误信息

### 如果支付仍然失败：
1. 确认Stripe密钥配置正确
2. 检查支付API端点是否可访问
3. 验证游客模式支付逻辑

## 📋 技术细节

### Token格式
```
Base64编码的: "userId:email:timestamp"
```

### Cookie配置说明
- `httpOnly: false`：允许前端JavaScript访问
- `secure: true`：生产环境强制HTTPS
- `sameSite: 'none'`：允许跨域传递
- `maxAge: 7天`：token有效期

### CORS关键配置
- `credentials: true`：允许携带cookie
- 明确列出允许的域名
- 包含所有必要的请求头

## 🎯 预期结果

修复后应该实现：
1. ✅ 用户登录后正确设置token cookie
2. ✅ 支付请求携带正确的Authorization头
3. ✅ 游客模式支付正常工作
4. ✅ 跨域请求不再出现CORS错误
5. ✅ 支付功能在Vercel部署环境下正常工作