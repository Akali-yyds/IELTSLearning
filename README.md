# IELTSLearning

面向 IELTS / TOEFL 等英语学习场景的本地优先学习应用。项目把“翻译文章 -> 双击查词 -> 加入生词本 -> 复习巩固 -> 数据统计”串成一条完整链路，前端使用 React + Vite，后端使用 FastAPI + SQLAlchemy。

## 当前能力

- 文章翻译与保存
- 双击单词弹窗查词
- ECDICT 本地词典秒级返回释义
- CMUdict + eSpeak 生成音标
- Piper / eSpeak 生成英式、美式发音
- Tatoeba 本地例句库查询，中文在导入时统一转为简体
- 生词本、记单词、今日复习、学习统计

## 技术栈

### 前端

- React 18
- TypeScript
- Vite
- React Router
- Axios
- ECharts

### 后端

- Python 3.11+
- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL

### 词典 / 发音 / 例句

- ECDICT：本地 SQLite 词典
- CMUdict：补充音标数据
- eSpeak：补充 IPA 音标、作为 Piper 的兜底发音方案
- Piper：英式 / 美式音频生成
- Tatoeba：本地 SQLite 例句库
- OpenCC：导入 Tatoeba 时统一转简体

## 项目结构

```text
IELTSLearning/
├─ backend/
│  ├─ app/
│  │  ├─ routers/
│  │  ├─ services/
│  │  ├─ config.py
│  │  ├─ main.py
│  │  ├─ models.py
│  │  └─ schemas.py
│  ├─ alembic/
│  ├─ data/
│  ├─ setup_ecdict.py
│  ├─ setup_tatoeba.py
│  └─ requirements.txt
├─ frontend/
│  ├─ src/
│  └─ package.json
├─ start.bat
└─ README.md
```

## 运行环境

- Node.js 18+
- Python 3.11+
- PostgreSQL 14+
- Windows 开发环境下建议直接使用项目里的 `uv` 虚拟环境流程

## 快速开始

### 1. 安装后端依赖

```powershell
cd backend
uv venv
.\.venv\Scripts\activate
uv pip install -r requirements.txt
```

### 2. 安装前端依赖

```powershell
cd ..\frontend
npm install
```

### 3. 配置后端 `.env`

在 `backend/.env` 中至少配置以下内容：

```env
DATABASE_URL=postgresql+psycopg2://postgres:password@localhost:5432/ielts_learning
JWT_SECRET_KEY=replace-with-a-random-secret

DEEPL_API_KEY=
DEEPL_API_URL=https://api-free.deepl.com

BAIDU_APPID=
BAIDU_SECRET_KEY=

TATOEBA_DB_PATH=data/tatoeba_examples.db

PIPER_PATH=piper
PIPER_DATA_DIR=data/piper_voices
PIPER_VOICE_EN_US=en_US-lessac-medium
PIPER_VOICE_EN_GB=en_GB-alan-medium
PIPER_MODEL_EN_US=
PIPER_MODEL_EN_GB=
PIPER_CONFIG_EN_US=
PIPER_CONFIG_EN_GB=

ESPEAK_PATH=espeak
```

说明：

- `DATABASE_URL`、`JWT_SECRET_KEY` 必填
- `DEEPL_*`、`BAIDU_*` 按需配置，至少准备一种翻译服务即可
- `PIPER_VOICE_EN_US` / `PIPER_VOICE_EN_GB` 支持按 voice 名称自动下载模型
- 如果你已经手动下载了 `.onnx` 模型，也可以直接填写 `PIPER_MODEL_EN_US` / `PIPER_MODEL_EN_GB`
- `ESPEAK_PATH` 是 Piper 不可用时的兜底方案，也用于补充 IPA 音标

### 4. 初始化数据库

```powershell
cd ..\backend
alembic upgrade head
```

### 5. 初始化 ECDICT

```powershell
.\.venv\Scripts\python.exe setup_ecdict.py
```

执行后会生成：

- `backend/data/stardict.db`

### 6. 初始化本地 Tatoeba 例句库

```powershell
.\.venv\Scripts\python.exe setup_tatoeba.py
```

这个脚本会：

- 下载官方 `eng_sentences.tsv.bz2`
- 下载官方 `cmn_sentences.tsv.bz2`
- 下载官方 `eng-cmn_links.tsv.bz2`
- 导入本地 SQLite
- 在导入阶段统一把中文转换为简体
- 建立 FTS 索引，供例句快速查询

执行后会生成：

- `backend/data/tatoeba_examples.db`

### 7. 启动项目

方式一：分别启动前后端

```powershell
cd backend
.\.venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

```powershell
cd frontend
npm run dev
```

方式二：使用一键启动脚本

```powershell
.\start.bat
```

访问地址：

- 前端：[http://localhost:5173](http://localhost:5173)
- 后端 API：[http://localhost:8000](http://localhost:8000)
- Swagger 文档：[http://localhost:8000/docs](http://localhost:8000/docs)

## 发音与例句说明

### 发音

- 单词释义弹窗先返回 ECDICT 基础内容
- 发音和例句随后异步补齐
- 音频优先使用 Piper 生成
- 若 Piper 不可用，则回退到 eSpeak
- 已生成音频会缓存到 `backend/data/generated_audio/`
- 后端通过 `/generated-audio` 静态路由暴露音频文件
- 设置页支持手动清理发音缓存
- 后端会在服务启动时按月检查一次，并自动清理 30 天前的旧发音缓存

### 例句

- 当前不再走在线 Tatoeba API
- 项目使用本地 SQLite 例句库查询
- 中文在导入阶段统一转换为简体，因此运行时不再做简繁转换
- 例句查询现在是本地检索，速度明显快于在线 API 方案

## 主要页面

- 翻译页：输入文章、机翻、双击查词、加入生词本
- 文章页：保存后的文章精读
- 生词本页：按生词本查看和管理词汇
- 记单词页：基于已存释义、音标、例句、音频做复习
- 今日复习页：按复习计划完成当天任务
- 仪表盘：查看学习统计
- 设置页：配置每日复习目标、查看缓存占用、手动清理发音缓存

## 设置与缓存

- 顶部导航栏里，深色模式切换按钮右侧提供独立“设置”入口
- 发音缓存目录为 `backend/data/generated_audio/`
- Piper 声音模型目录为 `backend/data/piper_voices/`
- 设置页的“清理缓存”当前只会清理发音音频缓存，不会删除 Piper 模型和 Tatoeba 本地例句库
- 自动清理默认策略为：服务启动时检查一次，若距离上次自动清理已超过 30 天，则清理 30 天前的旧音频

## 常见命令

### 前端

```powershell
cd frontend
npm run dev
npm run build
```

### 后端

```powershell
cd backend
.\.venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 重新构建本地例句库

```powershell
cd backend
.\.venv\Scripts\python.exe setup_tatoeba.py
```

## 数据来源

- ECDICT：[https://github.com/skywind3000/ECDICT](https://github.com/skywind3000/ECDICT)
- Tatoeba：[https://tatoeba.org](https://tatoeba.org)
- CMUdict：[https://www.speech.cs.cmu.edu/cgi-bin/cmudict](https://www.speech.cs.cmu.edu/cgi-bin/cmudict)
- Piper：[https://github.com/rhasspy/piper](https://github.com/rhasspy/piper)
- eSpeak：[https://espeak.sourceforge.net/](https://espeak.sourceforge.net/)

## 排查建议

- 查词没有结果：先确认 `backend/data/stardict.db` 是否已生成
- 例句为空：先确认 `backend/data/tatoeba_examples.db` 是否已生成
- 发音按钮不可用：先确认 `piper` 或 `espeak` 是否可执行
- 前端请求失败：先确认后端已启动在 `8000` 端口
- 数据库报错：先确认 PostgreSQL 已创建对应数据库，并执行过 `alembic upgrade head`

## 备注

- 项目当前默认面向本地开发环境
- `.env` 中不要提交真实密钥
- 如果需要切换 Piper 声音，直接修改 `PIPER_VOICE_EN_US` / `PIPER_VOICE_EN_GB` 即可
