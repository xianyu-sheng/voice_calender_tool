<div align="center">

# 🎙️ 语音日历工具

**一款支持语音交互的智能日程管理应用**

[![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-000000?logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

<br/>

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [技术架构](#-技术架构) • [使用指南](#-使用指南) • [API文档](#-api文档)

</div>

---

## 📸 界面预览

<div align="center">
  <img src="docs/screenshot.png" alt="应用界面" width="800" />
  <p><em>现代简洁的日历界面，支持日/周/月三种视图</em></p>
</div>

---

## ✨ 功能特性

### 🗓️ 日历管理
- **三种视图**：日视图、周视图、月视图自由切换
- **事件管理**：创建、编辑、删除日程事件
- **拖拽支持**：周视图支持拖拽调整事件时间
- **多日历**：支持多个日历分类，独立显示/隐藏

### 📋 TodoList 任务管理
- **任务增删改查**：完整的任务管理功能
- **优先级设置**：高/中/低三级优先级，颜色标识
- **进度追踪**：每个任务独立进度条，手动拖动调节
- **整体进度**：自动计算所有任务的平均进度
- **自动顺延**：未完成任务自动顺延到下一天

### 🎙️ 语音交互
- **语音输入**：支持中文语音识别
- **智能解析**：自然语言处理，识别多种表达方式
- **语音反馈**：操作结果语音播报

### 🎨 现代UI设计
- **渐变配色**：紫色渐变主题，视觉舒适
- **响应式布局**：左侧栏 + 主内容区经典布局
- **流畅动画**：平滑过渡和交互动画

---

## 🚀 快速开始

### 方式一：直接运行 exe（推荐）

1. 从 [Releases](https://github.com/xianyu-sheng/voice_calender_tool/releases) 下载最新版 `语音日历工具.exe`
2. 双击运行即可，无需安装

### 方式二：源码运行

#### 环境要求
- Python 3.10+
- Node.js 18+
- npm 或 yarn

#### 后端启动

```bash
# 进入后端目录
cd backend

# 创建虚拟环境（可选）
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# 安装依赖
pip install flask flask-cors flask-sqlalchemy

# 启动后端服务
python main.py
```

后端将在 `http://localhost:8000` 启动

#### 前端启动

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端将在 `http://localhost:5173` 启动

#### 打包为 exe

```bash
# 确保前端已构建
cd frontend && npm run build

# 返回根目录打包
cd ..
python -m PyInstaller build.spec --noconfirm
```

生成的 exe 文件在 `dist/语音日历工具.exe`

---

## 🏗️ 技术架构

```
voice_calender_tool/
├── frontend/                # 前端 React 应用
│   ├── src/
│   │   ├── components/      # UI 组件
│   │   │   ├── Header.tsx        # 顶部导航栏
│   │   │   ├── Sidebar.tsx       # 左侧栏（语音+导航+快捷指令）
│   │   │   ├── MonthView.tsx     # 月视图
│   │   │   ├── WeekView.tsx      # 周视图
│   │   │   ├── DayView.tsx       # 日视图（含Todo面板）
│   │   │   ├── EventModal.tsx    # 事件编辑弹窗
│   │   │   ├── TodoModal.tsx     # 任务编辑弹窗
│   │   │   └── VoiceFeedback.tsx # 语音反馈组件
│   │   ├── hooks/           # 自定义 Hooks
│   │   │   ├── useSpeechRecognition.ts  # 语音识别
│   │   │   ├── useSpeechSynthesis.ts    # 语音合成
│   │   │   └── useReminder.ts           # 提醒通知
│   │   ├── utils/           # 工具函数
│   │   │   └── voiceCommandParser.ts    # 语音指令解析器
│   │   ├── App.tsx          # 主应用组件
│   │   └── App.css          # 全局样式
│   └── package.json
│
├── backend/                 # 后端 Flask 应用
│   ├── app/
│   │   ├── api/             # API 蓝图
│   │   │   ├── events.py        # 事件 API
│   │   │   ├── calendars.py     # 日历 API
│   │   │   ├── reminders.py     # 提醒 API
│   │   │   └── todos.py         # 任务 API
│   │   ├── models/          # 数据模型
│   │   │   ├── event.py         # 事件模型
│   │   │   ├── calendar.py      # 日历模型
│   │   │   ├── reminder.py      # 提醒模型
│   │   │   └── todo.py          # 任务模型
│   │   ├── utils.py         # 工具函数
│   │   └── __init__.py      # 应用初始化
│   └── main.py              # 入口文件
│
├── build.spec               # PyInstaller 打包配置
└── README.md
```

### 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | React 18 + TypeScript | 用户界面框架 |
| **构建** | Vite | 快速开发构建工具 |
| **后端** | Flask + SQLAlchemy | RESTful API 服务 |
| **数据库** | SQLite | 轻量级本地存储 |
| **语音** | Web Speech API | 浏览器原生语音识别 |
| **打包** | PyInstaller | 生成独立 exe 文件 |

---

## 📖 使用指南

### 视图切换

点击左侧栏的 **日/周/月** 按钮切换不同视图：

| 视图 | 适用场景 |
|------|----------|
| 📅 月视图 | 查看整月日程概览，快速定位日期 |
| 📆 周视图 | 查看一周安排，支持拖拽调整事件 |
| 📋 日视图 | 查看当天详情，管理 TodoList |

### 语音指令

点击左侧栏麦克风按钮开始语音输入，支持以下指令：

#### 事件管理
```
"创建一个明天下午3点的会议"
"安排下周一下午2点到4点的技术评审"
"预约明天上午10点看牙医"
```

#### 任务管理
```
"创建任务：写周报"
"新建待办：买菜，高优先级"
"我需要完成项目文档"
"完成写周报任务"
"搞定了买菜"
```

#### 视图切换
```
"查看今天"
"看看本周"
"显示本月安排"
```

### TodoList 功能

1. **创建任务**：点击日视图任务面板的 `+` 按钮
2. **设置优先级**：选择高/中/低优先级
3. **调节进度**：拖动任务下方的进度滑块
4. **完成任务**：勾选任务左侧的复选框
5. **自动顺延**：开启后，未完成任务自动移到下一天

---

## 📡 API文档

### 事件 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/events` | 获取所有事件 |
| `POST` | `/api/events` | 创建事件 |
| `PUT` | `/api/events/:id` | 更新事件 |
| `DELETE` | `/api/events/:id` | 删除事件 |

### 任务 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/todos` | 获取任务列表 |
| `POST` | `/api/todos` | 创建任务 |
| `PUT` | `/api/todos/:id` | 更新任务 |
| `DELETE` | `/api/todos/:id` | 删除任务 |
| `PUT` | `/api/todos/:id/toggle` | 切换完成状态 |
| `PUT` | `/api/todos/:id/progress` | 更新进度 |
| `POST` | `/api/todos/postpone` | 执行自动顺延 |

### 日历 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/calendars` | 获取日历列表 |
| `POST` | `/api/calendars` | 创建日历 |
| `PUT` | `/api/calendars/:id` | 更新日历 |
| `DELETE` | `/api/calendars/:id` | 删除日历 |

---

## 🔧 配置说明

### 后端配置

在 `backend/main.py` 中可修改以下配置：

```python
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///calendar.db'  # 数据库路径
app.run(debug=True, host='0.0.0.0', port=8000)  # 服务端口
```

### 前端配置

在 `frontend/vite.config.ts` 中可配置开发服务器：

```typescript
export default defineConfig({
  server: {
    port: 5173,  // 开发端口
    proxy: {
      '/api': 'http://localhost:8000'  # API 代理
    }
  }
})
```

---

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'feat: 添加某功能'`
4. 推送分支：`git push origin feature/your-feature`
5. 提交 Pull Request

### 提交规范

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式（不影响功能）
refactor: 重构
test: 测试相关
chore: 构建/工具相关
```

---

## 📝 更新日志

### v2.0.0 (2025-05-31)
- ✨ 全新 UI 设计，渐变主题
- ✨ 新增 TodoList 任务管理功能
- ✨ 支持任务优先级和进度追踪
- ✨ 未完成任务自动顺延
- ✨ 扩展语音指令支持
- 🐛 修复多项已知问题

### v1.0.0 (2025-05-29)
- 🎉 初始版本发布
- ✨ 基础日历功能（日/周/月视图）
- ✨ 事件增删改查
- ✨ 语音输入支持
- ✨ 桌面通知提醒

---

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE) 开源。

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给个 Star 支持一下！**

Made with ❤️ by [xianyu-sheng](https://github.com/xianyu-sheng)

</div>
