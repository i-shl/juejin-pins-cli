# juejin-pins-cli

一个简洁的终端浏览掘金沸点命令行工具。

## 功能

- 📱 浏览掘金沸点（最新/热门）
- 🔄 分页加载
- 📖 查看沸点详情和评论
- ⌨️ 键盘快捷键 + 输入命令

## 安装

```bash
# 克隆项目
git clone <repository-url>
cd juejin-pins-cli

# 安装依赖
npm install
```

## 使用

### 方式一：直接运行

```bash
node cli.js
```

### 方式二：全局安装（推荐）

```bash
# 在项目目录下执行
npm link

# 然后在任意目录下都可以运行
juejin-pins

# 取消全局安装
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
| 输入 `new` | 切换到最新沸点 |
| 输入 `hot` | 切换到热门沸点 |
| `q` | 退出 |

### 详情页

| 操作 | 功能 |
|------|------|
| `Tab` | 返回列表 |
| `q` | 退出 |

## 项目结构

```
juejin-pins-cli/
├── cli.js              # 主程序入口
├── test.js             # API连接测试
├── test-comments.js    # 评论功能测试
├── demo.js             # 使用演示
├── package.json        # 项目配置
├── README.md           # 项目说明
└── .gitignore          # Git忽略文件
```

## 技术栈

- Node.js
- Axios

## 许可证

MIT