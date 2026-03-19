## IELTSLearning 项目说明

IELTSLearning 是一个面向英语学习者的 Web 应用，核心能力包括：

- 文章精读与全文翻译
- 划词 / 双击查词与发音
- 生词本与遗忘曲线复习
- 学习统计与目标设置

当前由 Agent 按 `TODOlist.txt` 中的规划分阶段实现。

### 技术栈

| 层级 | 技术 |
|------|------|
| **后端** | FastAPI + SQLAlchemy + PostgreSQL |
| **前端** | React + TypeScript + Vite |
| **认证** | JWT + Refresh Token |
| **词典** | Free Dictionary API |
| **翻译** | DeepL API（可配置） |
| **发音** | 词典 API + 浏览器 Web Speech API |

### 目录结构

```
IELTSLearning/
├── backend/                    # 后端服务（FastAPI）
│   ├── app/
│   │   ├── routers/           # API 路由模块
│   │   │   ├── auth.py        # 认证（注册/登录/刷新Token）
│   │   │   ├── articles.py    # 文章 CRUD
│   │   │   ├── dictionary.py  # 查词服务
│   │   │   ├── vocabulary.py  # 生词本
│   │   │   ├── reviews.py     # 复习系统
│   │   │   ├── dashboard.py   # 首页统计
│   │   │   ├── settings.py    # 用户设置
│   │   │   └── translation.py # 翻译服务
│   │   ├── services/          # 业务逻辑层
│   │   │   ├── review.py      # 遗忘曲线算法（SM-2）
│   │   │   ├── dictionary.py  # 字典服务封装
│   │   │   └── translation.py # 翻译服务封装
│   │   ├── models.py          # SQLAlchemy 模型
│   │   ├── schemas.py         # Pydantic 数据校验
│   │   ├── auth.py            # JWT 鉴权
│   │   ├── database.py        # 数据库连接
│   │   └── config.py          # 配置管理
│   ├── migrations/            # Alembic 数据库迁移
│   └── requirements.txt       # Python 依赖
│
├── frontend/                   # 前端应用（React + TS）
│   ├── src/
│   │   ├── modules/          # 页面模块
│   │   │   ├── auth/         # 登录/注册
│   │   │   ├── dashboard/    # 首页
│   │   │   ├── articles/     # 文章列表/编辑
│   │   │   ├── translate/    # 翻译页面
│   │   │   ├── vocabulary/   # 生词本/生词详情
│   │   │   ├── reviews/      # 今日复习
│   │   │   ├── space/        # 我的空间
│   │   │   ├── stats/        # 学习统计
│   │   │   ├── settings/     # 用户设置
│   │   │   └── dictionary/   # 查词弹窗
│   │   ├── App.tsx           # 应用入口
│   │   └── styles.css        # 全局样式
│   └── package.json          # Node 依赖
│
├── TODOlist.txt              # 需求与任务拆解
└── README.md                 # 项目说明
```

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │ Dashboard│ │ Articles│ │Translat.│ │Vocabulary│ │ Reviews│ │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬───┘ │
│       └───────────┴───────────┴───────────┴───────────┘    │
│                            │                                  │
│                      Vite Proxy / API                        │
└────────────────────────────┼────────────────────────────────┘
                             │ HTTP + JWT
┌────────────────────────────┼────────────────────────────────┐
│                     Backend (FastAPI)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │  Auth    │ │ Articles │ │ Dictionary│ │Vocabulary│         │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘         │
│       └────────────┴────────────┴─────────────┘              │
│                            │                                  │
│                    SQLAlchemy ORM                             │
└────────────────────────────┼────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────┐
│                   PostgreSQL Database                        │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐    │
│  │ Users  │ │Articles │ │Vocabulary│ │ReviewLogs│ │DailyTasks│ │
│  └────────┘ └────────┘ └────────┘ └────────┘ └──────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 数据库模型

### 核心数据表

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `users` | 用户表 | email, hashed_password, is_active |
| `user_settings` | 用户设置 | daily_review_target |
| `articles` | 文章 | title, original_text, translated_text, word_count |
| `vocabulary_notebooks` | 词汇本 | name, note |
| `vocabulary` | 生词 | word, lemma, phonetic, meanings_json, **SM-2 字段** |
| `review_logs` | 复习记录 | feedback, previous/new_familiarity, previous/new_interval |
| `daily_review_tasks` | 每日任务快照 | task_date, vocab_ids |

### SM-2 遗忘曲线字段（vocabulary 表）

- `familiarity_score`: 熟练度分数（0-100）
- `ease_factor`: 难度因子（默认 250）
- `interval_days`: 复习间隔天数
- `next_review_at`: 下次复习日期
- `status`: 单词状态（new / learning / reviewing / mastered）

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
- 全文翻译服务
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

#### Phase 6: 页面与信息架构 ✅
- 首页 Dashboard（快捷入口、统计概览、今日进度）
- 翻译页面（左右分栏、实时翻译、存为文章）
- 我的空间（复习进度、学习统计、快捷功能）
- 用户设置页面

### 页面清单

| 页面 | 路由 | 说明 |
|------|------|------|
| 登录页 | `/login` | 用户登录 |
| 注册页 | `/register` | 用户注册 |
| 首页 | `/` | 快捷入口、统计概览 |
| 翻译 | `/translate` | 左右分栏实时翻译 |
| 文章列表 | `/articles` | 已保存的文章列表 |
| 文章编辑 | `/articles/new`, `/articles/:id` | 添加/编辑文章 |
| 生词本 | `/vocabulary` | 生词本列表 |
| 生词详情 | `/vocabulary/:id` | 生词详情 |
| 我的空间 | `/space` | 复习进度、统计概览 |
| 今日复习 | `/space/reviews` | 每日复习任务 |
| 学习统计 | `/space/stats` | 详细统计数据 |
| 用户设置 | `/space/settings` | 每日复习目标设置 |

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

### 翻译
- `POST /translation/quick` - 快速翻译（不保存）

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

### Dashboard & 统计
- `GET /dashboard/overview` - 首页概览数据
- `GET /dashboard/stats` - 学习统计数据

### 设置
- `GET /settings` - 获取用户设置
- `PUT /settings` - 更新用户设置

---

## 下一步计划

- [ ] 移动端适配
- [ ] 深色模式优化
- [ ] 测试覆盖
- [ ] 生产环境部署

---

# IELTSLearning

Learning IELTS makes me happy.
