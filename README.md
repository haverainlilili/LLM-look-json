# Forma

Forma 是一个本地优先的动态 JSON 数据集浏览器。它负责稳定的文件读取、
Schema 推断、搜索、记录导航和安全渲染；可选的大模型只返回受限的布局蓝图，
不会生成或执行页面代码。

## 已支持

- 打开或拖入 `.json`、`.jsonl`、`.ndjson`
- 自动发现根数组以及 `data`、`records`、`items`、`rows` 等记录路径
- 推断字段类型、样例和出现率
- 对话、偏好对比、媒体引用、表格、卡片、原始 JSON 视图
- 全文搜索、记录导航、Schema 与布局蓝图检查器
- 本地启发式布局，未配置模型时也可完整使用
- 可选 OpenAI-compatible 模型布局分析
- 严格验证模型输出，只允许固定视图和字段角色

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

开发地址默认为 `http://localhost:3000`。

## 配置大模型

复制 `.env.example` 为 `.env.local`，填写服务端环境变量：

```bash
LLM_API_KEY=
LLM_API_BASE=https://your-provider.example/v1
LLM_MODEL_NAME=your-model
LLM_TIMEOUT_MS=45000
```

模型提供方需要兼容 chat-completions 请求和 JSON object 输出。密钥只在
`/api/analyze` 服务端路由使用，不会发送到浏览器。未配置时，点击“MING 重组布局”
会给出说明，并继续保留本地布局。`LLM_TIMEOUT_MS` 可选，允许范围为 5000–120000
毫秒；推理模型建议使用 45000 或更高。

## 安全模型

- 文件默认只在浏览器中解析，首版上限为 20 MB。
- 模型请求最多包含 5 条截断样本，整个请求不超过 64 KB。
- 数据集文本被明确标记为不受信任数据，不能覆盖布局指令。
- 模型只能返回 `conversation`、`comparison`、`gallery`、`table`、`cards`
  五种视图，以及白名单字段角色。
- 模型返回的路径必须存在于当前 Schema；不接受 HTML、CSS、脚本或组件代码。
- React 负责文本转义；媒体字段中的外部地址不会自动请求。
- 分析接口包含超时、令牌上限和基础频率限制。

## 命令

```bash
npm run test:unit   # 解析、Schema、布局和模型边界测试
npm test            # 完整构建与服务端渲染测试
npm run lint
npx tsc --noEmit
npm run build
```

## 代码结构

- `app/lib/`：解析、Schema 推断、布局 DSL、模型请求边界
- `app/components/`：工作台、Schema、渲染器和检查器
- `app/api/analyze/`：可选的大模型布局分析接口
- `SPEC.md`：产品规格、接口契约和威胁模型
- `tasks/`：实现计划与验收清单

## 当前限制

第一版使用浏览器内存解析，目标是快速验证动态布局框架，而不是替代多 GB
流式查看器。超大数据、Parquet/Arrow、桌面文件索引和团队标注适合作为后续版本。
