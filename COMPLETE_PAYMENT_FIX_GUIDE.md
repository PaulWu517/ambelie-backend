# 完整支付功能修复指南

## 🎯 问题总结

支付功能失败的根本原因是**跨域请求和Token传递链路断裂**：

1. **CORS配置缺失** → 前端无法正常访问后端API
2. **Cookie设置不当** → 后端生成token后没有正确设置cookie
3. **跨域Cookie传递失败** → Vercel到Railway的跨域环境下cookie无法传递
4. **Token验证链路不完整** → 前端无法获取有效token进行支付认证

## 🔧 已实施的修复

### 1. 后端修复 (ambelie-backend)

#### A. 新增CORS配置文件
📁 `config/cors.ts` - 专门的CORS配置
- 支持Vercel域名和本地开发
- 启用credentials传递
- 包含所有必要的请求头

#### B. 更新中间件配置
📁 `config/middlewares.ts` - 集成CORS配置
- 使用详细的CORS设置替换默认配置
- 支持跨域cookie传递

#### C. 修复Cookie设置
📁 `src/api/website-user/controllers/website-user.ts`
- 在用户登录成功后正确设置`website-user-token` cookie
- 配置适合跨域环境的cookie属性
- 支持生产环境的安全设置

#### D. 更新环境变量配置
📁 `.env.example` 和 `railway.env.example`
- 添加`FRONTEND_URL`配置
- 包含Stripe相关配置
- 明确CORS和数据库设置

### 2. 前端增强 (ambelie-next-app 1.1)

#### A. 新增Cookie工具函数
📁 `lib/cookie-utils.ts` - 完整的cookie操作工具
- 获取、设置、删除cookie的通用函数
- 专门的token获取和验证函数
- 用户登录状态检查

#### B. 增强Token获取调试
📁 `app/api/auth/get-token/route.ts`
- 添加详细的调试日志
- 列出所有可用cookie
- 更好的错误追踪

### 3. 文档和指南

#### A. 问题分析文档
📁 `PAYMENT_TOKEN_FIX.md` - 详细的问题分析和解决方案

#### B. 完整修复指南
📁 `COMPLETE_PAYMENT_FIX_GUIDE.md` - 本文档

## 🚀 部署步骤

### 1. 后端部署 (Railway)

```bash
# 1. 提交所有更改
cd ambelie-backend
git add .
git commit -m "Fix CORS and token cookie issues for payment functionality"
git push

# 2. Railway会自动重新部署
```

### 2. 环境变量配置

在Railway项目中确保设置以下环境变量：

```env
# 基础配置
NODE_ENV=production
HOST=0.0.0.0
PORT=1337

# CORS配置 (关键!)
FRONTEND_URL=https://ambelie-next-app-1-1.vercel.app

# 安全密钥 (保持现有值)
APP_KEYS=your_existing_keys
API_TOKEN_SALT=your_existing_salt
ADMIN_JWT_SECRET=your_existing_secret
TRANSFER_TOKEN_SALT=your_existing_salt
JWT_SECRET=your_existing_secret

# 数据库
DATABASE_SSL=false

# Stripe (如果还没配置)
STRIPE_PUBLIC_KEY=pk_test_your_key
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
```

### 3. 前端部署 (Vercel)

前端代码已经支持新的token获取机制，Vercel会自动部署。

## 🧪 测试验证

### 1. 用户登录测试

1. **访问前端网站**：https://ambelie-next-app-1-1.vercel.app
2. **进行邮箱验证登录**
3. **检查浏览器开发者工具**：
   - Application → Cookies
   - 应该看到 `website-user-token` cookie

### 2. Token获取测试

在浏览器控制台执行：
```javascript
// 检查cookie是否存在
document.cookie

// 测试token获取API
fetch('/api/auth/get-token', { credentials: 'include' })
  .then(r => r.json())
  .then(console.log)
```

### 3. 支付功能测试

1. **添加商品到购物车**
2. **进入结账页面**：/checkout
3. **填写客户信息**
4. **点击"Continue to Payment"**
5. **检查网络请求**：
   - 应该看到带有`Authorization: Bearer <token>`头的请求
   - 或者显示游客模式支付

### 4. CORS测试

在浏览器控制台执行：
```javascript
// 测试跨域请求
fetch('https://ambelie-backend-production.up.railway.app/api/payments/create-checkout-session', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    orderItems: [{ productId: 1, quantity: 1, unitPrice: 100 }],
    customerEmail: 'test@example.com',
    customerName: 'Test User',
    successUrl: 'https://ambelie-next-app-1-1.vercel.app/order/success',
    cancelUrl: 'https://ambelie-next-app-1-1.vercel.app/cart'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

## 🔍 故障排除

### 如果仍然无法获取token：

1. **检查Railway日志**：
   ```bash
   # 查看部署日志
   railway logs
   ```

2. **检查环境变量**：
   - 确认`FRONTEND_URL`设置正确
   - 确认`NODE_ENV=production`

3. **检查浏览器**：
   - 清除所有cookie和缓存
   - 检查是否有CORS错误
   - 查看Network标签中的请求详情

### 如果支付请求失败：

1. **检查Stripe配置**：
   - 确认所有Stripe密钥正确设置
   - 检查webhook配置

2. **检查API端点**：
   ```bash
   # 测试API可访问性
   curl -X POST https://ambelie-backend-production.up.railway.app/api/payments/create-checkout-session \
     -H "Content-Type: application/json" \
     -d '{"orderItems":[],"customerEmail":"test@test.com"}'
   ```

3. **检查游客模式**：
   - 即使没有token，支付应该以游客模式继续
   - 检查后端日志中的"continuing as guest"消息

## 📊 技术架构

### Token流程
```
用户登录 → 后端生成token → 设置cookie → 前端读取cookie → 支付请求携带token
```

### 游客模式流程
```
无token → 前端检测 → 游客模式支付 → 后端处理无认证请求
```

### CORS流程
```
前端请求 → 预检请求(OPTIONS) → CORS验证 → 实际请求 → 响应
```

## 🎯 预期结果

修复完成后应该实现：

✅ **用户认证**：登录后正确设置和获取token  
✅ **跨域请求**：Vercel到Railway的API调用正常  
✅ **支付功能**：认证用户和游客都能正常支付  
✅ **错误处理**：详细的调试信息和错误追踪  
✅ **生产环境**：在实际部署环境下稳定工作  

## 📞 支持

如果在部署过程中遇到问题：

1. 检查Railway和Vercel的部署日志
2. 使用浏览器开发者工具检查网络请求
3. 参考本文档的故障排除部分
4. 检查所有环境变量是否正确设置

---

**重要提醒**：部署后请务必进行完整的端到端测试，确保支付流程在生产环境下正常工作。