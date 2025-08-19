# Ambelie Backend - Railway 部署指南

这是 Ambelie 项目的 Strapi 后端，配置为在 Railway 平台上部署。

## 部署步骤

### 1. 推送代码到 GitHub

```bash
git init
git add .
git commit -m "Initial Strapi backend setup for Railway"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 2. 在 Railway 上部署

1. 访问 [Railway](https://railway.app/) 并登录
2. 点击 "New Project"
3. 选择 "Deploy from GitHub repo"
4. 选择您的 `ambelie-backend` 仓库
5. Railway 会自动检测 Dockerfile 并开始部署

### 3. 配置环境变量

在 Railway 项目设置中添加以下环境变量：

```
NODE_ENV=production
HOST=0.0.0.0
PORT=1337
APP_KEYS=O8bRSWz7h4cyiqddVaWymQ==,fFtwdnggFc40Lvt7XOf3eg==,iEFA7F1+OkxYVxLpVQbjqw==,uVbVynJkQoSg7zd9YpNU1w==
API_TOKEN_SALT=KmyiotKrAhL+e4/m94ev/Q==
ADMIN_JWT_SECRET=7hxWnzIaaNiXLxg8JAJU9w==
TRANSFER_TOKEN_SALT=OIBDIiViWs25EQP4f5uH7g==
JWT_SECRET=oWZMKsnLtFmcphjsVQFf2g==
DATABASE_SSL=false
FRONTEND_URL=https://your-frontend-domain.vercel.app

# 腾讯云COS配置
TENCENT_COS_SECRET_ID=your_secret_id_here
TENCENT_COS_SECRET_KEY=your_secret_key_here
TENCENT_COS_BUCKET=your_bucket_name_here
TENCENT_COS_REGION=ap-guangzhou
TENCENT_COS_CDN_DOMAIN=your_cdn_domain_here
```

### 4. 添加 PostgreSQL 数据库

1. 在 Railway 项目中点击 "Add Service"
2. 选择 "PostgreSQL"
3. Railway 会自动设置 `DATABASE_URL` 环境变量

### 5. 访问管理面板

部署完成后，访问 `https://your-railway-domain.railway.app/admin` 来设置管理员账户。

## 本地开发

```bash
npm install
npm run develop
```

## 项目结构

- `/config` - Strapi 配置文件
- `/src` - 应用源代码
- `/public` - 静态文件
- `Dockerfile` - Railway 部署配置
- `railway.env.example` - 环境变量示例

## 注意事项

- 确保在 Railway 中设置正确的 `FRONTEND_URL` 以启用 CORS
- 生产环境使用 PostgreSQL，开发环境使用 SQLite
- 所有敏感信息都通过环境变量配置
- **文件存储**：项目已配置使用腾讯云COS进行文件存储，无需在Railway中配置Volume
- **腾讯云COS配置**：确保在Railway环境变量中正确设置所有腾讯云COS相关配置
- **CDN域名**：建议配置腾讯云CDN以提高文件访问速度和稳定性