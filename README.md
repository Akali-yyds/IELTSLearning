# IELTSLearning

面向雅思备考场景的英语学习与词汇管理平台。

---

## 项目简介

IELTSLearning 是一个面向英语学习者的 Web 应用，聚焦文章精读、词汇积累与记忆复习三个核心场景。  
用户可以在平台中导入或粘贴英语文章，通过双击查词将生词加入生词本，并由系统根据遗忘曲线自动安排每日复习计划。  
项目适用于有系统性词汇积累需求的个人学习者，尤其针对雅思、托福等标准化考试备考场景。

---

## 项目背景 / 目标

在英语学习过程中，词汇积累、文章阅读与记忆复习往往分散在多个工具中，难以形成闭环。  
本项目希望将"读文章 → 查生词 → 加生词本 → 定期复习"整合为一套连贯的学习流程，避免工具切换带来的中断。  
项目目标是提供一个轻量、自托管的学习工具，让用户在阅读真实语料的同时完成词汇积累，并依靠 SM-2 算法的间隔复习降低遗忘率。

---

## 功能特性

- 支持文章录入、全文机器翻译与保存管理
- 支持双击单词弹窗查词，展示音标、中英文释义、词性、考试标注（雅思/托福/GRE）
- 支持将查词结果一键加入生词本，自动去重并记录词根形式
- 支持基于 SM-2 遗忘曲线的每日复习任务自动生成与调度
- 支持复习反馈（认识 / 模糊 / 不认识）驱动熟练度与复习间隔动态调整
- 支持学习统计数据展示，包括每日复习数、生词总量、掌握比例
- 支持用户注册登录、JWT 鉴权与每日复习目标自定义配置

---

## 项目演示

当前版本暂未提供公开在线演示，可通过本地部署方式体验完整功能。

### 核心使用流程

1. 注册并登录系统
2. 在翻译页面粘贴英语文章，触发机器翻译或保存为文章
3. 在文章精读页双击单词，弹窗查看释义后加入生词本
4. 进入"今日复习"完成每日词汇复习任务
5. 在统计页面查看学习进度与生词掌握情况

---

## 技术栈

### 前端

- React 18 + TypeScript
- Vite
- React Router

### 后端

- Python 3.11+
- FastAPI
- SQLAlchemy + Alembic

### 数据存储

- PostgreSQL（主数据库）
- ECDICT（本地 SQLite 离线词典，含 90 万词条）

### 外部服务

- DeepL API（文章翻译，可选）

### 认证

- JWT + Refresh Token

---

## 项目结构

```text
IELTSLearning/
├── backend/                # 后端服务（FastAPI）
│   ├── app/
│   │   ├── routers/        # API 路由模块
│   │   ├── services/       # 业务逻辑层（词典、翻译、复习算法）
│   │   ├── models.py       # SQLAlchemy 数据模型
│   │   ├── schemas.py      # Pydantic 数据校验
│   │   ├── auth.py         # JWT 鉴权
│   │   ├── database.py     # 数据库连接
│   │   └── config.py       # 配置管理
│   ├── migrations/         # Alembic 数据库迁移脚本
│   ├── data/               # ECDICT 本地词典文件（stardict.db）
│   └── requirements.txt
│
├── frontend/               # 前端应用（React + TypeScript）
│   ├── src/
│   │   ├── modules/        # 页面模块（auth / dashboard / translate / vocabulary / reviews 等）
│   │   ├── shared/         # 公共组件与工具
│   │   ├── App.tsx
│   │   └── styles.css
│   └── package.json
│
└── README.md
```

- `backend/app/routers/`：各功能模块的 HTTP 路由（认证、文章、词典、生词本、复习、统计、设置）
- `backend/app/services/`：核心业务逻辑，包括 ECDICT 查词、DeepL 翻译封装、SM-2 复习调度
- `frontend/src/modules/`：按页面功能拆分的 React 模块，各自包含页面组件与本地状态

---

## 环境要求

- Node.js >= 18.0
- Python >= 3.11
- PostgreSQL >= 14
- ECDICT 词典文件（`backend/data/stardict.db`，需单独下载，见下方说明）

---

## 安装步骤

### 1. 克隆项目

```bash
git clone https://github.com/your-name/IELTSLearning.git
cd IELTSLearning
```

### 2. 配置后端环境

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. 配置前端环境

```bash
cd ../frontend
npm install
```

### 4. 准备环境变量

在 `backend/` 目录下创建 `.env` 文件：

```env
DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/ielts_learning
JWT_SECRET_KEY=your-secret-key-here
DEEPL_API_KEY=your-deepl-key        # 可选，不填则翻译功能不可用
```

在 `frontend/` 目录下创建 `.env` 文件（可选，默认指向本地后端）：

```env
VITE_API_BASE_URL=http://localhost:8000
```

### 5. 初始化数据库

```bash
cd backend
alembic upgrade head
```

### 6. 下载 ECDICT 词典

ECDICT 词典文件（`stardict.db`）需单独获取并放置在 `backend/data/` 目录下。  
可从 [ECDICT 项目](https://github.com/skywind3000/ECDICT) 下载 CSV 后使用项目内脚本转换，或直接下载已构建的 SQLite 文件。  
若词典文件缺失，查词功能将不可用，其余功能不受影响。

---

## 快速开始

### 启动后端服务

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 启动前端服务

```bash
cd frontend
npm run dev
```

### 访问地址

- 前端：`http://localhost:5173`
- 后端 API：`http://localhost:8000`
- 接口文档（Swagger）：`http://localhost:8000/docs`

---

## 使用说明

### 普通用户使用流程

1. 注册并登录系统
2. 进入**翻译**页面，粘贴英语文章，点击"翻译"获取中文对照
3. 点击"保存文章"将文章存入文章库，后续可在**文章**页面重新打开精读
4. 在文章精读或翻译页面**双击任意单词**，弹窗展示释义、音标与词典信息，确认后点击"加入生词本"
5. 进入**生词本**查看已收录词汇，点击单词查看详情（中英文释义、例句、短语、标签）
6. 进入**今日复习**完成系统每日推送的复习任务，根据实际掌握程度选择"认识 / 模糊 / 不认识"
7. 在**统计**页面查看累计学习数据

### 生词本说明

- 双击查词后可选择加入哪个生词本（默认为"默认生词本"）
- 同一单词在同一生词本内不会重复添加
- 词典数据来自 ECDICT 本地词典，包含 IELTS / TOEFL / GRE / Oxford / Collins 标注

### 复习机制说明

复习系统采用 **SM-2 简化版**遗忘曲线算法：

- 新词首次加入后次日进入复习队列
- 每次复习根据反馈（认识 / 模糊 / 不认识）调整下次复习间隔
- 熟练度达到阈值后单词状态升级为"mastered"，复习频率降低

---

## 配置说明

| 配置项 | 是否必填 | 示例值 | 说明 |
|---|---|---|---|
| `DATABASE_URL` | 是 | `postgresql+psycopg2://user:pass@localhost:5432/ielts` | PostgreSQL 连接字符串 |
| `JWT_SECRET_KEY` | 是 | `your-random-secret` | JWT 签名密钥，建议使用随机长字符串 |
| `DEEPL_API_KEY` | 否 | `your-deepl-key` | DeepL 翻译 API 密钥，不填则翻译功能不可用 |
| `VITE_API_BASE_URL` | 否 | `http://localhost:8000` | 前端指向的后端地址，默认为本地 8000 端口 |

- 不要将真实密钥提交到版本控制系统
- `JWT_SECRET_KEY` 建议使用 `openssl rand -hex 32` 生成
