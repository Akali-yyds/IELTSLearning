## IELTSLearning 项目说明

本项目是一个面向英语学习者的应用，核心能力包括：

- 文章精读与全文翻译（左右分栏对照阅读）
- 划词 / 双击查词与发音
- 生词本与遗忘曲线复习

当前由 Agent 按 `TODOlist.txt` 中的规划分阶段实现。

### 技术栈

- **后端**: FastAPI + SQLAlchemy + PostgreSQL
- **前端**: React + TypeScript + Vite
- **认证**: JWT + Refresh Token

### 目录结构

```
backend/           # 后端服务（FastAPI）
frontend/          # 前端应用（React + TS）
TODOlist.txt       # 需求与任务拆解
README.md          # 项目说明
```

---

## 当前开发进展

### 已完成功能

#### Phase 1: 项目初始化 ✅
- 前后端项目结构搭建
- PostgreSQL 数据库配置
- Alembic 数据库迁移
- 环境变量管理

#### Phase 2: 用户系统 ✅
- 用户注册 / 登录
- JWT 鉴权
- Refresh Token 续签

#### Phase 3: 文章精读模块 ✅
- 文章 CRUD（创建、读取、更新、删除）
- **左右分栏布局**：左侧原文编辑，右侧全文翻译
- 全文翻译服务（接入翻译 API）
- 双击单词查词（弹窗显示释义、音标、发音）
- 发音功能（TTS）

#### Phase 4: 生词本模块 ✅
- 查词结果加入生词本
- 生词本列表页
- 生词详情页
- 防重复加词

#### Phase 5: 复习系统 ✅
- 遗忘曲线算法（SM-2 简化版）
- 每日任务生成
- 复习交互流程（认识/模糊/不认识）
- 复习进度记录

### 页面清单

| 页面 | 路由 | 状态 |
|------|------|------|
| 登录页 | `/login` | ✅ |
| 注册页 | `/register` | ✅ |
| 文章列表页 | `/articles` | ✅ |
| 文章编辑页 | `/articles/new`, `/articles/:id` | ✅ |
| 生词本列表页 | `/vocabulary` | ✅ |
| 生词详情页 | `/vocabulary/:id` | ✅ |
| 今日复习页 | `/reviews/today` | ✅ |

---

## 后端运行方式

1. 创建并配置数据库（PostgreSQL），设置环境变量：

   - `DATABASE_URL`，例如：`postgresql+psycopg2://user:password@localhost:5432/ielts_learning`
   - `JWT_SECRET_KEY`：JWT 密钥

2. 安装依赖：

   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. 初始化数据库迁移：

   ```bash
   cd backend
   alembic upgrade head
   ```

4. 运行开发服务器：

   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

5. 访问 `http://localhost:8000/docs` 查看 Swagger API 文档。

---

## 前端运行方式

1. 安装依赖：

   ```bash
   cd frontend
   npm install
   ```

2. 配置后端地址（可选，默认 `http://localhost:8000`）：

   在 `frontend/` 下创建 `.env`：
   ```
   VITE_API_BASE_URL=http://localhost:8000
   ```

3. 启动开发服务器：

   ```bash
   cd frontend
   npm run dev
   ```

4. 浏览器打开 `http://localhost:5173`。

---

## 核心 API 概览

### 认证
- `POST /auth/register` - 注册
- `POST /auth/login` - 登录
- `POST /auth/refresh` - 刷新 Token

### 文章
- `POST /articles` - 创建文章
- `GET /articles` - 文章列表
- `GET /articles/:id` - 文章详情
- `PUT /articles/:id` - 更新文章
- `DELETE /articles/:id` - 删除文章
- `POST /articles/:id/translate` - 翻译文章

### 字典
- `GET /dictionary?word=xxx` - 查词

### 生词本
- `POST /vocabulary` - 加入生词本
- `GET /vocabulary` - 生词本列表
- `GET /vocabulary/:id` - 生词详情
- `DELETE /vocabulary/:id` - 删除生词

### 复习
- `GET /reviews/today` - 今日任务
- `POST /reviews/:vocabId/submit` - 提交复习结果

---

## 下一步计划

- [ ] 学习统计页（累计掌握数、连续天数等）
- [ ] 用户设置页（每日复习数量配置）
- [ ] 深色模式
- [ ] 移动端适配
- [ ] 测试覆盖
- [ ] 生产环境部署

---

# IELTSLearning

Learning IELTS makes me happy.
