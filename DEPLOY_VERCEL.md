# Vercel 前端部署指南

将 `frontend` 部署到 Vercel 非常简单，但因为**后端部署在宝塔（通常是 HTTP）**，而 **Vercel 强制使用 HTTPS**，会遇到 **混合内容 (Mixed Content)** 问题。

请仔细阅读以下步骤，特别是第 3 节的解决方案。

## 1. 基础配置

在 Vercel控制台导入你的 Git 仓库时，需要修改 **Root Directory** 和 **Build Settings**。

### 1.1 项目设置
- **Framework Preset**: Vite
- **Root Directory**: `frontend` (非常重要！点击 Edit 修改)

### 1.2 构建设置 (Build & Output Settings)
- **Build Command**: `npm run build` (默认)
- **Output Directory**: `dist` (默认)
- **Install Command**: `npm install` (默认)

### 1.3 环境变量
在 Environment Variables 中添加：
- `VITE_API_BASE_URL`: 你的后端地址 (例如 `https://api.yourdomain.com`)
  > 注意：这里必须是 HTTPS 地址（见下文）。

## 2. 代码修改

确保前端代码优先使用环境变量中的 API 地址。
检查 `frontend/src/constants.ts`：

```typescript
export const API_CONFIG = {
  // 优先读取环境变量，否则回退到本地
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002',
  API_KEY: 'iot-secret',
};
```
(如果是 Vite，使用 `import.meta.env`。)

## 3. 关键问题：HTTPS 混合内容 (Mixed Content)

Vercel 部署后的网站是 `https://your-project.vercel.app`。
如果你的后端是 `http://1.2.3.4:3002` (HTTP)，浏览器会**拦截请求**并报错：
> `Blocked loading mixed active content`

### 解决方案

#### 方案 A：给后端配置 SSL (推荐)
在宝塔面板中为你的后端配置 HTTPS。
1. **绑定域名**：在宝塔新建一个站点（如 `api.yourdomain.com`），指向后端项目。
2. **申请证书**：在宝塔中为该域名申请 Let's Encrypt 免费证书。
3. **反向代理**：在该站点设置反向代理，指向 `http://127.0.0.1:3002`。
4. **前端配置**：将 Vercel 的环境变量 `VITE_API_BASE_URL` 设置为 `https://api.yourdomain.com`。

#### 方案 B：后端也部署到支持 HTTP 的平台 (不推荐)
Vercel 强制 HTTPS，所以只要用 Vercel，后端就必须是 HTTPS。

#### 方案 C：使用 Cloudflare 代理 (进阶)
如果你的后端 IP 只有 HTTP，可以将域名接入 Cloudflare，开启 "Always Use HTTPS" 和 SSL (Flexible 或 Full)，让 Cloudflare 处理 HTTPS，回源到 HTTP。

## 4. 总结步骤
1. 修改 `frontend/src/constants.ts` 支持环境变量读取。
2. 提交代码到 Git。
3. 在 Vercel 导入项目，设置 Root Directory 为 `frontend`。
4. **解决 SSL 问题**（在宝塔配置 HTTPS）。
5. 在 Vercel 设置 `VITE_API_BASE_URL` 为你的 HTTPS 后端地址。
6. 重新部署 (Redeploy)。
