# IoT Launch Interface

**概览**
- 前端与后端已拆分为独立目录，便于部署与维护
- 前端（React + Vite）提供可视化与音频效果
- 后端（Node）提供步骤触发、状态推送与查询接口

**目录结构**
- `frontend/` 前端应用（端口 `3000`），含静态资源
- `backend/` 后端服务（端口 `3002`）
- `mind+/` Mind+ 图形化编程文件

**环境要求**
- Node 18+
- 浏览器建议 Chrome/Edge 最新版

**安装依赖**
- 前端安装
```
npm --prefix frontend install
```
- 后端安装
```
npm --prefix backend install
```

**开发调试**
- 启动后端（API）
```
npm --prefix backend run start
```
- 启动前端（UI）
```
npm --prefix frontend run dev
```
- 访问前端
```
http://localhost:3000/
```

**生产部署**
- 构建前端
```
npm --prefix frontend run build
```
- 部署前端
  - 将 `frontend/dist/` 用任意静态文件服务器（Nginx、Netlify、Vercel 等）托管
  - 或使用 `npm --prefix frontend run preview` 临时预览
- 启动后端
```
npm --prefix backend run start
```
- 前端与后端分离部署时，将 `frontend/constants.ts` 的 `API_CONFIG.BASE_URL` 指向后端地址（默认为 `http://localhost:3002`）

**后端配置**
- 环境变量
  - `API_KEY`：接口认证密钥（默认 `iot-secret`）
  - `MAX_CONCURRENCY`：并发上限（默认 `100`）
  - `PORT`：服务端口（默认 `3002`）
- 文件依赖
  - `frontend/metadata.json`：后端步骤处理所需的配置
  - `frontend/public/sounds/`：音频资源（`bgm.mp3`、`step1.mp3`、`step2.mp3`、`step3.mp3`）

**资源路径**
- 前端静态资源目录配置为 `publicDir: 'public'`（`frontend/vite.config.ts`）
- 请将音频文件放在 `frontend/public/sounds`，Logo 放在 `frontend/public/images` 等路径

**常见问题**
- 无法自动播放
  - 浏览器设置为允许站点自动播放
  - 确认 `frontend/public/sounds/bgm.mp3` 文件存在且可访问
- 接口未授权
  - 在请求头中添加 `X-API-Key`，并确保与后端的 `API_KEY` 一致
- 端口冲突
  - 前端使用 `3000`（严格端口），后端使用 `3002`
  - 如需更改，修改 `frontend/vite.config.ts` 和后端环境变量 `PORT`

**代码参考**
- 后端引擎与路由：`backend/services/stepsEngine.js`
- 后端服务入口：`backend/server.js`
- 前端入口：`frontend/index.html`、`frontend/index.tsx`
- 前端应用：`frontend/App.tsx`
- 前端常量与服务：`frontend/constants.ts`、`frontend/services/*`
- 可视化组件：`frontend/components/Visualizer.tsx`

