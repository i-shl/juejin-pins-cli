#!/usr/bin/env node
import { postJson, formatFetchError } from './post-json.js'

const PINS_API_URL = 'https://api.juejin.cn/recommend_api/v1/short_msg/recommend'
const COMMENTS_API_URL = 'https://api.juejin.cn/interact_api/v1/comment/list'
const REPLIES_API_URL = 'https://api.juejin.cn/interact_api/v1/reply/list'

const SORT_TYPE = { NEW: 300, HOT: 200 }

/** 清屏并回到光标原点（含滚动缓冲，减轻 Windows 终端叠字） */
const CLEAR = '\x1b[3J\x1b[2J\x1b[H'

const paint = (content) => {
  process.stdout.write(CLEAR + content)
}

// 颜色
const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  brightBlue: '\x1b[94m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
}

let cursor = '0'
let pins = []
let currentPage = 1
let currentTab = 'new'
let currentPin = null
let comments = []
let commentCursor = '0'
let inputBuffer = ''
let errorMsg = ''
let expandedReplies = {}

const fetchPins = async () => {
  errorMsg = ''
  try {
    const sortType = currentTab === 'new' ? SORT_TYPE.NEW : SORT_TYPE.HOT
    const data = await postJson(PINS_API_URL, {
      id_type: 4, sort_type: sortType, cursor, limit: 10,
    })
    if (data.err_no === 0) {
      pins = data.data || []
      cursor = data.cursor || '0'
      if (pins.length === 0) errorMsg = '暂无数据，请按 s 刷新重试'
    } else {
      errorMsg = 'API错误: ' + data.err_msg
    }
  } catch (e) {
    pins = []
    errorMsg = formatFetchError(e)
  }
}

const fetchComments = async (msgId) => {
  comments = []
  commentCursor = '0'
  expandedReplies = {}

  try {
    let hasMore = true
    while (hasMore) {
      const data = await postJson(COMMENTS_API_URL, {
        cursor: commentCursor, limit: 50, item_id: msgId, item_type: 4, sort_type: 200,
      })

      if (data.err_no === 0) {
        const newComments = data.data || []
        comments = comments.concat(newComments)
        commentCursor = data.cursor || '0'
        hasMore = data.has_more || false
      } else {
        hasMore = false
      }
    }

    for (const cm of comments) {
      const replyCount = cm.comment_info?.reply_count || 0
      if (replyCount > (cm.reply_infos?.length || 0)) {
        await fetchReplies(cm.comment_id, msgId)
      }
    }
    return true
  } catch (e) {}
  return false
}

const fetchReplies = async (commentId, msgId) => {
  try {
    const data = await postJson(REPLIES_API_URL, {
      cursor: '0', limit: 50, comment_id: commentId, item_id: msgId, item_type: 4, sort_type: 200,
    })
    if (data.err_no === 0) {
      expandedReplies[commentId] = data.data || []
      return true
    }
  } catch (e) {}
  return false
}

const formatTime = (ts) => {
  if (!ts) return ''
  return new Date(parseInt(ts) * 1000).toLocaleString('zh-CN')
}

/** pic_list 项可能是 URL 字符串或 { url } 等对象 */
const picListUrls = (picList) => {
  if (!Array.isArray(picList)) return []
  return picList
    .map((p) => {
      if (typeof p === 'string') return p
      if (p && typeof p === 'object') return p.url || p.pic_url || p.src || ''
      return ''
    })
    .filter(Boolean)
}

const renderPins = () => {
  const lines = []
  lines.push(`${c.brightWhite}🚀 掘金沸点 CLI 浏览器${c.reset}`)
  lines.push('')
  const newTab = currentTab === 'new'
    ? `${c.green}▶ 最新${c.reset}`
    : `${c.gray}  最新${c.reset}`
  const hotTab = currentTab === 'hot'
    ? `${c.green}▶ 热门${c.reset}`
    : `${c.gray}  热门${c.reset}`
  lines.push(`  [${newTab}]    [${hotTab}]`)
  lines.push('')

  if (errorMsg) {
    lines.push(`  ${c.red}❌ ${errorMsg}${c.reset}`)
    lines.push('')
  } else if (pins.length === 0) {
    lines.push(`  ${c.gray}暂无沸点数据${c.reset}`)
    lines.push('')
  } else {
    pins.forEach((pin, i) => {
      const author = pin.author_user_info?.user_name || '匿名'
      const content = pin.msg_Info?.content || '无内容'
      const cc = pin.msg_Info?.comment_count || 0
      const dc = pin.msg_Info?.digg_count || 0
      const time = formatTime(pin.msg_Info?.ctime)
      const picUrls = picListUrls(pin.msg_Info?.pic_list)
      lines.push(`${c.yellow}[${i + 1}]${c.reset} ${c.brightCyan}👤 ${author}${c.reset}`)
      lines.push(`    ${c.white}${content}${c.reset}`)
      if (picUrls.length > 0) {
        lines.push(`    ${c.yellow}📷 图片${c.reset}`)
        picUrls.forEach((url, pi) => {
          lines.push(`    ${c.gray}${pi + 1}. ${url}${c.reset}`)
        })
      }
      lines.push(`    ${c.gray}💬 ${cc} | 👍 ${dc} | ${time}${c.reset}`)
      lines.push('')
    })
  }

  lines.push(`${c.gray}─`.repeat(50) + c.reset)
  lines.push(`${c.green}第 ${currentPage} 页${c.reset} | ${c.cyan}1-10${c.reset}详情 ${c.cyan}←→${c.reset}翻页 ${c.cyan}s${c.reset}刷新 ${c.cyan}new/hot${c.reset}切换 ${c.cyan}q${c.reset}退出`)
  lines.push(`${c.gray}─`.repeat(50) + c.reset)
  lines.push(`${c.green}> ${c.reset}` + inputBuffer)
  paint(lines.join('\n'))
}

const renderDetail = () => {
  const a = currentPin.author_user_info?.user_name || '匿名'
  const j = currentPin.author_user_info?.job_title || ''
  const content = currentPin.msg_Info?.content || '无内容'
  const cc = currentPin.msg_Info?.comment_count || 0
  const dc = currentPin.msg_Info?.digg_count || 0
  const picUrls = picListUrls(currentPin.msg_Info?.pic_list)

  const lines = []
  lines.push(`${c.brightWhite}📖 沸点详情${c.reset}`)
  lines.push('')
  lines.push(`${c.brightCyan}👤 ${a}${j ? c.gray + ` (${j})` : ''}${c.reset}`)
  lines.push('')
  lines.push(`${c.white}${content}${c.reset}`)
  lines.push('')

  if (picUrls.length > 0) {
    lines.push(`${c.yellow}📷 图片${c.reset}`)
    picUrls.forEach((url, i) => {
      lines.push(`   ${c.gray}${i + 1}. ${url}${c.reset}`)
    })
    lines.push('')
  }

  lines.push(`${c.yellow}💬 ${cc} | 👍 ${dc}${c.reset}`)
  lines.push('')

  if (comments.length) {
    lines.push(`${c.gray}─`.repeat(50) + c.reset)
    lines.push(`${c.brightWhite}💬 评论 (${comments.length})${c.reset}`)
    lines.push(`${c.gray}─`.repeat(50) + c.reset)
    comments.forEach((cm, i) => {
      const ca = cm.user_info?.user_name || '匿名'
      const cc2 = cm.comment_info?.comment_content || ''
      const cd = cm.comment_info?.digg_count || 0
      const commentId = cm.comment_id

      lines.push(`${c.yellow}${i + 1}.${c.reset} ${c.cyan}${ca}${c.reset}: ${c.white}${cc2}${c.reset} ${c.gray}👍${cd}${c.reset}`)

      const replies = expandedReplies[commentId] || cm.reply_infos || []
      replies.forEach((reply) => {
        const ra = reply.user_info?.user_name || '匿名'
        const rContent = reply.reply_info?.reply_content || ''
        const rDiggs = reply.reply_info?.digg_count || 0
        const replyTo = reply.reply_user?.user_name
        if (replyTo) {
          lines.push(`   ${c.gray}└${c.reset} ${c.brightCyan}${ra}${c.reset} ${c.gray}回复${c.reset} ${c.cyan}${replyTo}${c.reset}: ${c.white}${rContent}${c.reset} ${c.gray}👍${rDiggs}${c.reset}`)
        } else {
          lines.push(`   ${c.gray}└${c.reset} ${c.brightCyan}${ra}${c.reset}: ${c.white}${rContent}${c.reset} ${c.gray}👍${rDiggs}${c.reset}`)
        }
      })
      lines.push('')
    })
  }

  lines.push(`${c.gray}─`.repeat(50) + c.reset)
  lines.push(`${c.cyan}Tab${c.reset} 返回列表 | ${c.cyan}q${c.reset} 退出`)
  lines.push(`${c.gray}─`.repeat(50) + c.reset)
  lines.push(`${c.green}> ${c.reset}` + inputBuffer)
  paint(lines.join('\n'))
}

const handle = async (cmd) => {
  if (currentPin) {
    if (cmd === 'q') { process.stdout.write('\n👋 再见!\n'); process.exit(0) }
    currentPin = null; comments = []; commentCursor = '0'; expandedReplies = {}
    inputBuffer = ''; renderPins(); return
  }

  const k = cmd.toLowerCase()

  if (k === 'q') { process.stdout.write('\n👋 再见!\n'); process.exit(0) }
  if (k === 's') {
    cursor = '0'; currentPage = 1
    await fetchPins(); inputBuffer = ''; renderPins(); return
  }
  if (k === 'new') {
    currentTab = 'new'; cursor = '0'; currentPage = 1
    await fetchPins(); inputBuffer = ''; renderPins(); return
  }
  if (k === 'hot') {
    currentTab = 'hot'; cursor = '0'; currentPage = 1
    await fetchPins(); inputBuffer = ''; renderPins(); return
  }
  if (k === '←' || k === 'left') {
    if (currentPage > 1) { currentPage--; cursor = '0'; await fetchPins() }
    inputBuffer = ''; renderPins(); return
  }
  if (k === '→' || k === 'right') {
    currentPage++; await fetchPins(); inputBuffer = ''; renderPins(); return
  }

  const idx = parseInt(k) - 1
  if (idx >= 0 && idx < pins.length) {
    currentPin = pins[idx]; comments = []; commentCursor = '0'; expandedReplies = {}
    inputBuffer = ''
    paint(`${c.cyan}⏳ 加载中...${c.reset}`)
    await fetchComments(currentPin.msg_id)
    renderDetail()
  } else {
    inputBuffer = ''; renderPins()
  }
}

const setupInput = () => {
  if (process.stdin.isTTY) process.stdin.setRawMode(true)
  process.stdin.setEncoding('utf8')
  process.stdin.resume()

  let isProcessing = false

  process.stdin.on('data', async (key) => {
    if (key === '\x03') { process.stdout.write('\n👋 再见!\n'); process.exit(0) }

    if (isProcessing) return

    if (key === '\t') {
      if (currentPin) {
        isProcessing = true
        try { await handle('tab') } finally { isProcessing = false }
      }
      return
    }

    if (key === '\r' || key === '\n') {
      if (inputBuffer.trim()) {
        isProcessing = true
        try { await handle(inputBuffer.trim()) } finally { isProcessing = false }
      }
      return
    }

    if (key === '\b' || key === '\x7f') {
      if (inputBuffer.length) {
        inputBuffer = inputBuffer.slice(0, -1)
        process.stdout.write('\b \b')
      }
      return
    }

    if (key === '\u001b[D') {
      isProcessing = true
      try { await handle('←') } finally { isProcessing = false }
      return
    }
    if (key === '\u001b[C') {
      isProcessing = true
      try { await handle('→') } finally { isProcessing = false }
      return
    }

    if (key.length === 1 && key >= ' ') {
      inputBuffer += key
      process.stdout.write(key)
    }
  })
}

const main = async () => {
  paint(`${c.cyan}🚀 启动中...${c.reset}`)
  await fetchPins()
  setupInput()
  renderPins()
}

main()
