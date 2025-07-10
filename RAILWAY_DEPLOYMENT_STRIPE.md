# Railway 环境变量配置 - Stripe支付集成

## 📋 完整的环境变量列表

请在Railway项目的环境变量设置中添加以下配置：

### 基础配置
```env
NODE_ENV=production
HOST=0.0.0.0
PORT=1337
```

### 安全密钥（已有的不要修改）
```env
APP_KEYS=O8bRSWz7h4cyiqddVaWymQ==,fFtwdnggFc40Lvt7XOf3eg==,iEFA7F1+OkxYVxLpVQbjqw==,uVbVynJkQoSg7zd9YpNU1w==
API_TOKEN_SALT=KmyiotKrAhL+e4/m94ev/Q==
ADMIN_JWT_SECRET=7hxWnzIaaNiXLxg8JAJU9w==
TRANSFER_TOKEN_SALT=OIBDIiViWs25EQP4f5uH7g==
JWT_SECRET=oWZMKsnLtFmcphjsVQFf2g==
```

### 数据库配置
```env
DATABASE_SSL=false
```

### 网站配置
```env
PUBLIC_URL=https://ambelie-backend-production.up.railway.app
FRONTEND_URL=https://ambelie-next-app-1-1.vercel.app
```

### **🔑 Stripe支付配置（新增）**
```env
STRIPE_PUBLIC_KEY=pk_test_your_publishable_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
PAYMENT_CURRENCY=USD
PAYMENT_SUCCESS_URL=https://ambelie-next-app-1-1.vercel.app/order/success
PAYMENT_CANCEL_URL=https://ambelie-next-app-1-1.vercel.app/cart
```

> **🔒 重要提示：请将上述占位符替换为您的实际Stripe密钥**
> - 可发布密钥：pk_test_...
> - 秘密密钥：sk_test_...
> - 这些密钥只在Railway环境变量中配置，不要提交到代码仓库

## 🚀 配置步骤

### 1. 登录Railway控制台
- 访问 https://railway.app/
- 进入您的 `ambelie-backend` 项目

### 2. 添加环境变量
- 点击项目设置
- 选择 "Variables" 标签
- 逐个添加上述环境变量

### 3. 重新部署
- 保存环境变量后，Railway会自动重新部署
- 等待部署完成

## 📍 重要提示

1. **STRIPE_WEBHOOK_SECRET**：暂时留空，等配置webhook后再设置
2. **已有环境变量**：请保留现有的APP_KEYS等安全密钥
3. **前端域名**：请确保FRONTEND_URL设置正确，用于CORS配置

## 🔄 下一步

配置完成后，我们将：
1. 配置Stripe Webhook
2. 测试支付API
3. 实现前端结账页面

## 📞 API端点

部署完成后，您将拥有以下支付API：

- **创建支付会话**：`POST /api/payments/create-checkout-session`
- **Webhook处理**：`POST /api/payments/webhook`
- **获取支付详情**：`GET /api/payments/session/:sessionId`
- **订单管理**：`GET /api/orders/...` 