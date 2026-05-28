# LocalSearch Pro - 项目记忆文档

> 本文档是项目开发的核心参考，包含完整的实现思路、前后端逻辑流程、数据结构设计。
> 所有开发决策应以此文档为准。

---

## 一、产品定位

**一句话定义**：面向中文用户的全离线本地知识检索工具，支持文件内容级搜索。

**核心差异化**：
- vs 系统自带搜索：支持内容搜索，不只搜文件名
- vs Everything：支持文件内容检索，不只搜文件名
- vs DocFetcher：现代化 UI，中文语义友好，毫秒级响应

**核心价值**：隐私零泄露、内容级检索、中文语义友好、毫秒级响应

---

## 二、技术架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                        Tauri v2 桌面应用                         │
├─────────────────────────┬───────────────────────────────────────┤
│     前端层 (WebView)     │           后端层 (Rust Core)           │
│                         │                                       │
│  React 18 + TypeScript  │  ┌─────────────────────────────────┐  │
│  TailwindCSS 4.x        │  │         Commands 层              │  │
│  Vite 6.x               │  │  (Tauri IPC 接口，前端调用入口)   │  │
│                         │  └──────────────┬──────────────────┘  │
│  职责：                  │                 │                     │
│  - UI 渲染              │  ┌──────────────▼──────────────────┐  │
│  - 用户交互             │  │         Core 层                  │  │
│  - 状态管理             │  │  (业务逻辑：搜索/索引/结果排序)   │  │
│                         │  └──────────────┬──────────────────┘  │
│                         │                 │                     │
│                         │  ┌──────────────▼──────────────────┐  │
│                         │  │       基础设施层                  │  │
│                         │  │  Tantivy │ SQLite │ notify │ ... │  │
│                         │  └─────────────────────────────────┘  │
├─────────────────────────┴───────────────────────────────────────┤
│                    Tauri IPC (进程内通信，零网络)                  │
└─────────────────────────────────────────────────────────────────┘
```

**关键约束**：
- 全程零网络请求（真离线）
- 前后端通过 Tauri IPC 通信（非 HTTP）
- 所有计算密集型任务在 Rust 侧完成

---

## 三、核心数据流

### 3.1 索引建立流程

```
触发时机：
  - 首次启动 → 用户选择监控目录
  - 文件系统变更 → notify 事件触发
  - 手动触发 → 重建索引

流程：
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ 文件系统监控  │────▶│  事件队列     │────▶│  事件合并     │
│ (notify)     │     │ (channel)    │     │ (debounce)   │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                                  ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Tantivy 写入 │◀────│  文本提取     │◀────│  文件类型检测 │
│ (倒排索引)   │     │ (parser)     │     │ (by ext)     │
└──────┬───────┘     └──────────────┘     └──────────────┘
       │
       ▼
┌──────────────┐
│ SQLite 写入  │
│ (元数据)     │
└──────────────┘
```

**具体步骤**：
1. `notify` 监控目录，捕获 Create/Modify/Delete 事件
2. 事件进入 Tokio channel，由 debounce 模块合并（300ms 窗口）
3. 根据文件扩展名选择对应 Parser
4. Parser 提取纯文本内容（处理编码检测）
5. Tantivy 写入倒排索引（jieba 分词）
6. SQLite 写入文件元数据（路径/哈希/大小/时间）

### 3.2 搜索查询流程

```
用户输入
    │
    ▼
┌──────────────┐     ┌──────────────┐
│  前端防抖     │────▶│  Tauri IPC   │
│  (50ms)      │     │  invoke()    │
└──────────────┘     └──────┬───────┘
                            │
                            ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Query Parser │────▶│ Tantivy      │────▶│ 结果排序     │
│ (AST 解析)   │     │ Searcher     │     │ (BM25)       │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                                  ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ 前端渲染     │◀────│ 片段高亮     │◀────│ SQLite 补全  │
│ (React)      │     │ 生成         │     │ 元数据       │
└──────────────┘     └──────────────┘     └──────────────┘
```

**具体步骤**：
1. 用户输入 → 前端 50ms 防抖
2. 通过 `invoke("search_query", { query, page, filters })` 调用后端
3. Query Parser 解析高级语法（`title:预算 AND 2024 NOT 草稿`）
4. Tantivy Searcher 执行倒排索引查询
5. BM25 算法排序，取 Top N
6. SQLite 补充文件元数据（大小/修改时间/路径）
7. 生成搜索片段（包含上下文 + 高亮标记）
8. 返回前端，React 渲染结果列表

### 3.3 预览流程

```
用户点击结果项
    │
    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ 前端发送     │────▶│ Rust 读取    │────▶│ 根据类型     │
│ IPC 请求     │     │ 文件内容     │     │ 生成预览     │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                                  ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ 前端渲染     │◀────│ 返回结构化   │◀────│ 匹配位置     │
│ 预览面板     │     │ 预览数据     │     │ 计算         │
└──────────────┘     └──────────────┘     └──────────────┘
```

**预览数据结构**：
```typescript
interface PreviewResult {
  type: "text" | "code" | "table" | "pdf";
  content: string;           // 预览内容
  language?: string;         // 代码语言
  highlights: Highlight[];   // 高亮位置
  metadata: FileMetadata;    // 文件元信息
}

interface Highlight {
  start: number;
  end: number;
  keyword: string;
  color: string;             // 多关键词区分颜色
}
```

---

## 四、模块职责与接口设计

### 4.1 前端模块

```
src/
├── main.tsx                 # React 入口
├── App.tsx                  # 根组件，布局管理
│
├── components/
│   ├── SearchBar.tsx        # 搜索输入框
│   │   - 输入防抖 (50ms)
│   │   - 语法提示下拉
│   │   - 搜索历史
│   │
│   ├── ResultList.tsx       # 结果列表
│   │   - 虚拟滚动 (大量结果)
│   │   - 高亮片段渲染
│   │   - 悬停操作按钮
│   │
│   ├── PreviewPanel.tsx     # 预览面板
│   │   - 多类型预览渲染
│   │   - 匹配跳转导航
│   │   - 文件元信息展示
│   │
│   ├── FilterBar.tsx        # 类型筛选栏
│   │   - 全部/文档/表格/代码/图片
│   │
│   └── StatusBar.tsx        # 索引状态栏
│       - 索引进度
│       - 文档总数
│       - 最后更新时间
│
├── hooks/
│   ├── useSearch.ts         # 搜索 IPC 封装
│   │   - invoke("search_query")
│   │   - invoke("search_suggest")
│   │
│   ├── useIndex.ts          # 索引 IPC 封装
│   │   - invoke("index_status")
│   │   - invoke("index_create")
│   │
│   └── useHotkey.ts         # 全局快捷键
│       - Ctrl+K 聚焦搜索
│       - Alt+Space 全局浮窗
│
├── stores/
│   └── searchStore.ts       # 搜索状态 (Zustand 或 useState)
│       - query: string
│       - results: SearchResult[]
│       - loading: boolean
│       - selectedId: string
│
└── types/
    └── index.ts             # TypeScript 类型定义
```

### 4.2 后端模块

```
src-tauri/src/
├── main.rs                  # Tauri 入口，注册 Commands
├── lib.rs                   # 模块导出
│
├── commands/                # Tauri Commands（前端调用接口）
│   ├── mod.rs
│   ├── search.rs            # 搜索相关命令
│   │   - search_query(query, page, filters) -> SearchResult
│   │   - search_suggest(partial) -> Vec<Suggestion>
│   │
│   ├── index.rs             # 索引管理命令
│   │   - index_create(paths) -> IndexStatus
│   │   - index_rebuild() -> IndexStatus
│   │   - index_status() -> IndexStatus
│   │
│   ├── preview.rs           # 预览命令
│   │   - preview_file(file_id) -> PreviewResult
│   │
│   └── config.rs            # 配置命令
│       - get_config() -> AppConfig
│       - set_config(config) -> Result
│
├── core/                    # 业务核心逻辑
│   ├── search_engine.rs     # 搜索引擎
│   │   - execute_query(ast) -> Vec<RawResult>
│   │   - merge_results(bm25, vector) -> Vec<ScoredResult>
│   │
│   ├── index_manager.rs     # 索引管理器
│   │   - start_watcher(paths)
│   │   - stop_watcher()
│   │   - process_event(event)
│   │
│   └── query_parser.rs      # 查询语法解析
│       - parse(input) -> QueryAST
│       - 支持: AND/OR/NOT/title:/filetype:
│
├── indexer/                 # Tantivy 封装
│   ├── tantivy_facade.rs    # 索引读写门面
│   │   - create_writer()
│   │   - add_document(doc)
│   │   - commit()
│   │   - search(query) -> Vec<DocId>
│   │
│   ├── tokenizer.rs         # jieba 分词器
│   │   - create_tokenizer() -> Tokenizer
│   │   - load_custom_dict(path)
│   │
│   └── schema.rs            # 索引 Schema 定义
│       - 文件名 (Text, 分词)
│       - 内容 (Text, 分词, 存储)
│       - 扩展名 (Text, 不分词)
│       - 路径 (Text, 不分词, 存储)
│
├── parser/                  # 文档解析器
│   ├── mod.rs               # Parser trait
│   │   trait Parser {
│   │       fn parse(&self, path: &Path) -> Result<ParsedDoc>;
│   │       fn supported_extensions(&self) -> &[&str];
│   │   }
│   │
│   ├── pdf.rs               # PDF 解析 (pdf-extract)
│   ├── docx.rs              # Word 解析 (docx-rs)
│   ├── xlsx.rs              # Excel 解析 (calamine)
│   ├── txt.rs               # 纯文本解析 (encoding_rs 编码检测)
│   ├── code.rs              # 代码解析 (tree-sitter)
│   └── archive.rs           # 压缩包解析 (zip)
│
├── watcher/                 # 文件监控
│   ├── mod.rs               # Watcher 封装
│   │   - start(paths, sender)
│   │   - stop()
│   │
│   └── debounce.rs          # 事件合并
│       - 300ms 窗口内合并同类事件
│       - 批量处理队列
│
├── db/                      # SQLite 操作
│   ├── mod.rs               # 数据库初始化
│   ├── schema.sql           # 表结构定义
│   └── file_meta.rs         # 文件元数据 CRUD
│       - upsert_meta(meta)
│       - get_meta(id) -> FileMeta
│       - mark_deleted(path)
│
└── utils/                   # 工具模块
    ├── encoding.rs          # 编码检测
    │   - detect_encoding(bytes) -> Encoding
    │   - decode(bytes, encoding) -> String
    │
    └── hash.rs              # 文件哈希
        - file_hash(path) -> Sha256Hash
```

---

## 五、数据结构定义

### 5.1 索引 Schema (Tantivy)

```rust
// tantivy 字段定义
pub fn build_schema() -> Schema {
    let mut schema_builder = Schema::builder();
    
    // 文件路径（存储，不索引，用于结果展示）
    schema_builder.add_text_field("path", STRING | STORED);
    
    // 文件名（索引 + 分词，用于搜索）
    schema_builder.add_text_field("name", TEXT | STORED);
    
    // 文件内容（索引 + 分词 + 存储片段，用于搜索和预览）
    schema_builder.add_text_field("content", TEXT | STORED);
    
    // 文件扩展名（索引，不分词，用于筛选）
    schema_builder.add_text_field("ext", STRING | STORED);
    
    // 文件大小（数值，用于排序）
    schema_builder.add_u64_field("size", INDEXED | STORED);
    
    // 修改时间戳（数值，用于排序）
    schema_builder.add_i64_field("modified_at", INDEXED | STORED);
    
    // 所属库标识（索引，不分词）
    schema_builder.add_text_field("library", STRING | STORED);
    
    schema_builder.build()
}
```

### 5.2 SQLite 表结构

```sql
-- 文件元数据表
CREATE TABLE IF NOT EXISTS file_meta (
    id           TEXT PRIMARY KEY,        -- UUID
    path         TEXT NOT NULL UNIQUE,     -- 文件完整路径
    content_hash TEXT NOT NULL,            -- 内容 SHA256
    size         INTEGER NOT NULL,         -- 文件大小(bytes)
    modified_at  INTEGER NOT NULL,         -- 修改时间戳
    indexed_at   INTEGER NOT NULL,         -- 索引时间戳
    library      TEXT NOT NULL,            -- 所属库
    status       TEXT DEFAULT 'active',    -- active/deleted/error
    error_msg    TEXT                      -- 错误信息
);

CREATE INDEX idx_file_meta_path ON file_meta(path);
CREATE INDEX idx_file_meta_library ON file_meta(library);
CREATE INDEX idx_file_meta_status ON file_meta(status);

-- 搜索历史表
CREATE TABLE IF NOT EXISTS search_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    query      TEXT NOT NULL,
    result_cnt INTEGER,
    created_at INTEGER NOT NULL
);

-- 索引库配置表
CREATE TABLE IF NOT EXISTS library (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    paths      TEXT NOT NULL,              -- JSON 数组
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

### 5.3 前端类型定义

```typescript
// 搜索结果
interface SearchResult {
  id: string;
  name: string;
  path: string;
  ext: string;
  size: number;
  modifiedAt: number;
  score: number;
  snippets: Snippet[];
}

// 搜索片段
interface Snippet {
  text: string;
  highlights: Highlight[];
}

// 高亮位置
interface Highlight {
  start: number;
  end: number;
  keyword: string;
  colorIndex: number;
}

// 预览结果
interface PreviewResult {
  type: "text" | "code" | "table" | "pdf" | "image";
  content: string;
  language?: string;
  highlights: Highlight[];
  metadata: FileMetadata;
}

// 文件元数据
interface FileMetadata {
  id: string;
  name: string;
  path: string;
  ext: string;
  size: number;
  modifiedAt: number;
  indexedAt: number;
  library: string;
}

// 索引状态
interface IndexStatus {
  totalDocs: number;
  indexedDocs: number;
  isIndexing: boolean;
  lastUpdated: number;
  libraries: Library[];
}

// 库配置
interface Library {
  id: string;
  name: string;
  paths: string[];
  createdAt: number;
  updatedAt: number;
}

// 应用配置
interface AppConfig {
  theme: "light" | "dark" | "system";
  globalHotkey: string;
  maxResults: number;
  snippetLength: number;
  autoStart: boolean;
  libraries: Library[];
}
```

---

## 六、IPC 接口清单

| Command 名称 | 参数 | 返回值 | 说明 |
|-------------|------|--------|------|
| `search_query` | `{ query, page, pageSize, filters }` | `SearchResult[]` | 执行搜索 |
| `search_suggest` | `{ partial }` | `string[]` | 搜索建议 |
| `index_create` | `{ paths }` | `IndexStatus` | 创建索引 |
| `index_rebuild` | `{ libraryId? }` | `IndexStatus` | 重建索引 |
| `index_status` | `{}` | `IndexStatus` | 获取索引状态 |
| `preview_file` | `{ fileId }` | `PreviewResult` | 获取文件预览 |
| `get_config` | `{}` | `AppConfig` | 获取配置 |
| `set_config` | `{ config }` | `void` | 保存配置 |
| `open_file` | `{ path }` | `void` | 用系统默认程序打开 |
| `open_folder` | `{ path }` | `void` | 打开文件所在目录 |

---

## 七、搜索语法设计

### 基础搜索
```
预算                    → 普通关键词搜索
预算 2024              → 多关键词 AND 搜索
```

### 高级语法
```
title:预算              → 仅搜索文件名
content:预算            → 仅搜索文件内容
filetype:docx           → 指定文件类型
budget OR 预算          → OR 逻辑
预算 NOT 草稿           → 排除关键词
"季度预算"              → 精确短语匹配
```

### 组合查询
```
title:预算 AND (2024 OR 2025) NOT 草稿 filetype:docx
```

### 查询 AST 结构
```rust
enum QueryNode {
    Term { field: Option<String>, value: String },
    Phrase { field: Option<String>, words: Vec<String> },
    And(Box<QueryNode>, Box<QueryNode>),
    Or(Box<QueryNode>, Box<QueryNode>),
    Not(Box<QueryNode>, Box<QueryNode>),
}
```

---

## 八、开发里程碑

### M1: MVP (6周)
- [ ] Tauri 项目骨架搭建
- [ ] 基础 UI 框架（搜索框 + 结果列表 + 预览面板）
- [ ] Tantivy 索引集成 + jieba 分词
- [ ] TXT/MD 文件解析
- [ ] 基础关键词搜索
- [ ] Windows 打包发布

### M2: v1.0 (+4周)
- [ ] PDF/Word/Excel 解析
- [ ] 高级搜索语法
- [ ] 预览面板完善
- [ ] 多库管理
- [ ] 暗色模式
- [ ] macOS 打包发布

### M3: v1.5 (+6周)
- [ ] 语义搜索 (bge-small-zh)
- [ ] OCR 支持
- [ ] 压缩包内文本索引
- [ ] CLI 工具
- [ ] 代码文件语法高亮

### M4: v2.0 (+8周)
- [ ] Linux 支持
- [ ] HTTP API
- [ ] 插件系统
- [ ] Alfred/Raycast 集成

---

## 九、开发原则

1. **真离线**：安装包零网络请求，更新检查可关闭，无 telemetry
2. **编码零感知**：自动检测文件编码，用户永远看不到乱码
3. **渐进索引**：首次启动先快速索引高频目录，后台深度处理
4. **资源保护**：检测到大型软件运行时自动暂停索引线程
5. **反脆弱**：索引损坏自动检测并提示重建，文件已删除结果置灰提示

---

## 十、关键依赖版本锁定

| 依赖 | 版本 | 说明 |
|------|------|------|
| Tauri | 2.x | 桌面框架 |
| React | 18.x | UI 框架 |
| TypeScript | 5.x | 类型系统 |
| Vite | 6.x | 构建工具 |
| TailwindCSS | 4.x | 样式框架 |
| Tantivy | 0.22.x | 全文索引 |
| rusqlite | 0.32.x | SQLite |
| notify | 6.x | 文件监控 |
| Tokio | 1.x | 异步运行时 |

---

*文档版本: v1.0 | 最后更新: 2026-05-24*
