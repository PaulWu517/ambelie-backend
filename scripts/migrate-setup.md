# 媒体文件迁移到腾讯云 COS 指南

## 迁移前准备

### 1. 数据库备份（⚠️ 必须执行）
```bash
# Railway PostgreSQL 备份（通过 Railway CLI）
railway login
railway connect PostgreSQL
# 或者通过 pg_dump 命令备份
```

### 2. 环境变量配置

在 `ambelie-backend` 目录下创建 `.env.local` 文件（或更新现有 `.env` 文件）：

```env
# 数据库配置（从 Railway 获取）
DATABASE_HOST=your_database_host
DATABASE_PORT=5432
DATABASE_NAME=railway
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password

# 或者直接使用 Railway 的 DATABASE_URL
DATABASE_URL=postgresql://postgres:password@host:port/database

# 腾讯云 COS 配置
TENCENT_COS_SECRET_ID=your_secret_id
TENCENT_COS_SECRET_KEY=your_secret_key
TENCENT_COS_BUCKET=ambelie-1368352639
TENCENT_COS_REGION=ap-guangzhou
TENCENT_COS_CDN_DOMAIN=https://media.ambelie.com

# Node 环境
NODE_ENV=production
```

### 3. 验证配置

运行测试命令确认配置正确：

```bash
cd "c:\Users\21483\Desktop\Ambelie 原型设计\ambelie-backend"
node -e "console.log('DB:', process.env.DATABASE_URL || 'Not set'); console.log('COS ID:', process.env.TENCENT_COS_SECRET_ID ? 'Set' : 'Not set');"
```

## 执行迁移

### 方式一：直接运行脚本

```bash
cd "c:\Users\21483\Desktop\Ambelie 原型设计\ambelie-backend"
npm run migrate:media
```

### 方式二：手动执行 Node 脚本

```bash
cd "c:\Users\21483\Desktop\Ambelie 原型设计\ambelie-backend"
node ./scripts/migrate-media-to-cos.js
```

## 迁移后验证

### 1. 检查前台页面
- 访问 http://localhost:3001/
- 查看首页、产品列表、详情页图片是否正常加载
- 确认图片 URL 已变为 `https://media.ambelie.com/uploads/...`

### 2. 检查 Strapi 后台
- 访问 Strapi 管理界面
- 查看媒体库中的图片预览
- 尝试上传新图片验证配置

### 3. 数据库验证
```sql
-- 检查迁移后的记录
SELECT id, name, url, provider, formats 
FROM upload_files 
WHERE provider = 'strapi-provider-upload-tencent-cloud-cos'
LIMIT 5;

-- 确认没有遗留的旧域名 URL
SELECT COUNT(*) as old_urls_count
FROM upload_files 
WHERE url LIKE '%railway.app%';
```

## 回滚方案

如果迁移出现问题，可以：

1. 停止 Strapi 服务
2. 从备份恢复数据库：
   ```bash
   # 恢复 PostgreSQL 备份
   psql -h hostname -U username -d database_name < backup_file.sql
   ```
3. 重启 Strapi 服务

## 常见问题

### Q: 脚本提示"COS 配置不完整"
A: 检查 `.env` 文件中的腾讯云相关环境变量是否正确设置。

### Q: 下载文件失败
A: 可能是网络问题或旧的 Railway 媒体文件已被清理，可以跳过这些文件。

### Q: 上传到 COS 失败
A: 检查 COS 权限设置和 Bucket 配置，确保 SecretId/SecretKey 有写权限。

### Q: 图片仍然显示不出来
A: 检查 Next.js 的 `next.config.ts` 中是否正确配置了 `media.ambelie.com` 域名。

## 技术细节

迁移脚本会：
1. 查询所有 `provider != 'strapi-provider-upload-tencent-cloud-cos'` 的文件记录
2. 从旧 URL 下载文件到内存
3. 上传到腾讯云 COS，保持相同的路径结构（`uploads/...`）
4. 更新数据库记录：
   - `url`: 替换为新的 CDN 域名
   - `formats`: 更新各种尺寸缩略图的 URL
   - `provider`: 更新为腾讯云 COS provider
5. 设置 COS 对象的 ACL 为 `public-read`

预计迁移时间：取决于文件数量和大小，通常每个文件 1-3 秒。