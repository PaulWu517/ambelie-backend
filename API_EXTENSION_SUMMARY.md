# Ambelie Backend API 扩展总结

本文档总结了为 Ambelie 项目扩展 `website-user` 表结构和创建新 API 端点的完整实现。

## 📋 完成的工作

### 1. 扩展 website-user 表结构

**文件**: `src/api/website-user/content-types/website-user/schema.json`

**新增字段**:
- `cart`: JSON 类型，默认值为空数组 `[]`，用于存储用户购物车数据
- `inquiries`: JSON 类型，默认值为空数组 `[]`，用于存储用户询价数据

### 2. 创建购物车 API 端点

**控制器**: `src/api/cart/controllers/cart.ts`
**路由**: `src/api/cart/routes/cart.ts`

**API 端点**:
- `GET /api/cart` - 获取用户购物车
- `POST /api/cart/add` - 添加商品到购物车
- `PUT /api/cart/update` - 更新购物车商品数量
- `DELETE /api/cart/remove/:productId` - 从购物车移除商品
- `DELETE /api/cart/clear` - 清空购物车
- `POST /api/cart/sync` - 同步本地购物车到后端

### 3. 创建询价 API 端点

**控制器**: `src/api/inquiry/controllers/inquiry.ts`
**路由**: `src/api/inquiry/routes/inquiry.ts`

**API 端点**:
- `GET /api/inquiries` - 获取用户询价列表
- `POST /api/inquiries/add` - 添加商品到询价列表
- `DELETE /api/inquiries/remove/:productId` - 从询价列表移除商品
- `DELETE /api/inquiries/clear` - 清空询价列表
- `POST /api/inquiries/sync` - 同步本地询价列表到后端
- `POST /api/inquiries/submit` - 提交询价请求

### 4. 创建收藏 API 端点

**控制器**: `src/api/wishlist/controllers/wishlist.ts`
**路由**: `src/api/wishlist/routes/wishlist.ts`

**API 端点**:
- `GET /api/wishlist` - 获取用户收藏列表
- `POST /api/wishlist/add` - 添加商品到收藏列表
- `DELETE /api/wishlist/remove/:productId` - 从收藏列表移除商品
- `DELETE /api/wishlist/clear` - 清空收藏列表
- `POST /api/wishlist/sync` - 同步本地收藏列表到后端
- `GET /api/wishlist/check/:productId` - 检查商品是否在收藏列表中

### 5. 更新前端 Store 文件

**更新的文件**:
- `lib/stores/cartStore.ts` - 添加后端同步功能
- `lib/stores/inquiryStore.ts` - 添加后端同步和提交功能
- `lib/stores/collectionStore.ts` - 添加后端同步功能

**新增功能**:
- `syncWithBackend()` - 将本地数据同步到后端
- `loadFromBackend()` - 从后端加载数据
- `isLoading` 状态管理
- `lastSyncTime` 同步时间记录
- 自动同步机制（在本地操作后自动尝试同步）

## 🔧 技术实现细节

### 认证机制
所有 API 端点都支持基于 JWT token 的用户认证：
- 从请求头 `Authorization: Bearer <token>` 获取用户身份
- 未认证用户的操作会被记录但不会报错（优雅降级）

### 数据存储策略
- **购物车和询价**: 存储在 `website-user` 表的 JSON 字段中
- **收藏**: 使用现有的关系型数据模型（`wishlist` 关联到 `product`）

### 错误处理
- 所有 API 都包含完善的错误处理
- 前端 Store 包含错误恢复机制
- 网络错误时优雅降级，不影响用户体验

### 混合存储策略
- **本地存储**: 使用 `zustand` + `persist` 中间件
- **后端存储**: 通过 API 同步到数据库
- **自动同步**: 本地操作后自动尝试同步到后端
- **手动同步**: 提供手动同步方法

## 🧪 测试

**测试文件**: `test-new-apis.js`

运行测试：
```bash
# 确保 Strapi 服务器正在运行
npm run develop

# 在另一个终端运行测试
node test-new-apis.js
```

测试覆盖：
- 所有新创建的 API 端点
- 基本的 CRUD 操作
- 同步功能
- 错误处理

## 📦 部署说明

### 后端部署
1. 所有新的 API 端点会自动被 Strapi 注册
2. 数据库迁移会自动应用新的字段
3. 无需额外配置

### 前端部署
1. 更新的 Store 文件包含向后兼容性
2. 环境变量 `NEXT_PUBLIC_API_URL` 需要指向正确的后端地址
3. 用户认证机制需要正常工作

## 🔄 API 使用示例

### 购物车操作
```javascript
// 添加商品到购物车
const response = await fetch('/api/cart/add', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    productId: 'product-123',
    quantity: 2
  })
});
```

### 同步本地数据到后端
```javascript
// 同步购物车
const response = await fetch('/api/cart/sync', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    items: cartItems
  })
});
```

### 提交询价
```javascript
// 提交询价请求
const response = await fetch('/api/inquiries/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    customerInfo: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890'
    },
    message: 'I am interested in these products'
  })
});
```

## 🎯 下一步建议

1. **测试**: 在开发环境中全面测试所有新功能
2. **优化**: 根据实际使用情况优化 API 性能
3. **监控**: 添加 API 使用情况监控
4. **文档**: 为前端开发者提供详细的 API 文档
5. **安全**: 审查和加强 API 安全措施

## 📞 支持

如有问题或需要进一步的功能扩展，请参考：
- Strapi 官方文档
- 项目的其他 API 实现
- 测试文件中的示例代码

---

✅ **状态**: 所有功能已完成并可投入使用
📅 **完成时间**: 2024年12月
🔧 **技术栈**: Strapi v5, TypeScript, Node.js, PostgreSQL