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

克隆仓库后**无需安装依赖**，直接运行：

```bash
node cli.js
```

或使用：

```bash
npm start
```

### 全局安装（可选）

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
└── .gitignore
```

## 技术栈

- Node.js 18+（ESM，原生 `fetch`）

## 许可证

MIT
