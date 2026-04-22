# juejin-pins-cli

一个简洁的终端浏览掘金沸点命令行工具。

## 功能

- 📱 浏览掘金沸点（最新/热门）
- 🔄 分页加载
- 📖 查看沸点详情和评论
- ⌨️ 键盘快捷键 + 输入命令

## 环境要求

- Node.js 18+（内置 `fetch`，建议当前 LTS）

## 使用

### 从 npm 全局安装（推荐）

需 Node.js 18+。安装：

```bash
npm install -g juejin-pins-cli
```

任意目录运行 `juejin-pins`。卸载：`npm uninstall -g juejin-pins-cli`。

### 从 GitHub 全局安装（一键）

需已安装 Node.js 18+。任选其一执行即可，效果相同：

```bash
npm install -g https://github.com/i-shl/juejin-pins-cli.git
```

```bash
npm install -g git+https://github.com/i-shl/juejin-pins-cli.git
```

安装后在任意目录运行：

```bash
juejin-pins
```

卸载全局包：

```bash
npm uninstall -g juejin-pins-cli
```

### 克隆后本地运行

克隆仓库后**无需安装依赖**，直接运行：

```bash
git clone https://github.com/i-shl/juejin-pins-cli.git
cd juejin-pins-cli
node cli.js
```

或使用：

```bash
npm start
```

### 全局安装（开发 / npm link）

在已克隆的项目目录内：

```bash
npm link
juejin-pins

# 取消全局链接
npm unlink -g juejin-pins-cli
```

## 操作说明

### 列表页

| 操作 | 功能 |
|------|------|
| `←` 左方向键 | 上一页 |
| `→` 右方向键 | 下一页 |
| `s` | 刷新 |
| `1-10` | 查看对应沸点详情 |
| 输入 `new` 后回车 | 切换到最新沸点 |
| 输入 `hot` 后回车 | 切换到热门沸点 |
| `q` | 退出 |

### 详情页

| 操作 | 功能 |
|------|------|
| `Tab` | 返回列表 |
| `q` | 退出 |

## 项目结构

```
juejin-pins-cli/
├── cli.js          # 主程序入口
├── post-json.js    # fetch POST JSON（含超时）
├── package.json
├── README.md
├── LICENSE
└── .gitignore
```

## 技术栈

- Node.js 18+（ESM，原生 `fetch`）

## 维护者：发布到 npm

1. **注册并登录**：[npm 注册](https://www.npmjs.com/signup)，终端执行 `npm login`，用 `npm whoami` 确认当前用户。
2. **检查包名**：在 [npm](https://www.npmjs.com/) 搜索 `juejin-pins-cli`。若已被占用，需修改本仓库 `package.json` 里的 `name`（例如使用作用域包 `@你的用户名/juejin-pins-cli`，发布时执行 `npm publish --access public`）。
3. **预检**：`npm pack` 查看将要上传的文件；或 `npm publish --dry-run` 模拟发布。
4. **发布**：在项目根目录执行 `npm publish`（无作用域的包默认为公开）。
5. **升级版本**：修改代码后使用 `npm version patch`（或 `minor` / `major`） bump 版本并打 git 标签，再执行 `npm publish`。若不用 `npm version`，可手动改 `package.json` 的 `version` 后再 `npm publish`。

发布成功后，他人可通过上文「从 npm 全局安装」一节安装。

## 许可证

MIT（见 [LICENSE](./LICENSE)）
