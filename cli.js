#!/usr/bin/env node
import { postJson, fetchImageBuffer, formatFetchError } from './post-json.js'
import terminalImage from 'terminal-image'
import sharp from 'sharp'
import { image2sixel } from 'sixel'
import { createSupportsTerminalGraphics } from 'supports-terminal-graphics'

// 检测终端是否支持 Sixel（Windows Terminal 1.22+ 支持）
const termSupport = createSupportsTerminalGraphics(process.stdout)
const useSixel = termSupport.sixel || !!process.env.WT_SESSION

/** Sixel 图片宽度（像素），基于终端列数估算 */
const sixelWidth = (cols) => Math.min(Math.floor(cols * 8), 800)

const PINS_API_URL = 'https://api.juejin.cn/recommend_api/v1/short_msg/recommend'
const COMMENTS_API_URL = 'https://api.juejin.cn/interact_api/v1/comment/list'
const REPLIES_API_URL = 'https://api.juejin.cn/interact_api/v1/reply/list'

const SORT_TYPE = { NEW: 300, HOT: 200 }

/** 清屏并回到光标原点（含滚动缓冲，减轻 Windows 终端叠字） */
const CLEAR = '\x1b[3J\x1b[2J\x1b[H'

/** 与底栏同宽，便于对齐；终端列数不可用时回退 */
const MARK_W = 50

/** 当前终端宽度（列） */
const termCols = () => {
  const n = process.stdout.columns
  return n && n > 0 ? n : MARK_W
}

/** 终端显示宽度估算：ASCII 1，其余按 2（中文等） */
const displayWidth = (str) => {
  let w = 0
  for (const ch of str) {
    w += ch.codePointAt(0) < 0x80 ? 1 : 2
  }
  return w
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
  /** 顶部分隔带：深灰底 + 浅灰字（不用品红等艳色） */
  markBg: '\x1b[100m',
  markFg: '\x1b[37m',
}

/**
 * 顶部分隔带：分页/列表详情切换时若终端残留旧内容，用户可据此判断「以下才是当前屏」
 */
const screenTopMarker = () => {
  const cols = termCols()
  const row = (text) => `${c.markBg}${c.markFg}${text}${c.reset}`
  const bar = row('─'.repeat(cols))
  const tipText = ' ▼ 以下为当前屏内容（上方若有残影请忽略）'
  const pad = Math.max(0, cols - displayWidth(tipText))
  const tip = row(tipText + ' '.repeat(pad))
  return [bar, tip, bar, ''].join('\n')
}

const paint = (content) => {
  process.stdout.write(CLEAR + content)
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
let pageCursors = ['0']
let showImages = false

// 图片缓存: url -> { buffer, rendered }
const imageCache = new Map()

const fetchPins = async () => {
  errorMsg = ''
  try {
    const sortType = currentTab === 'new' ? SORT_TYPE.NEW : SORT_TYPE.HOT
    const data = await postJson(PINS_API_URL, {
      id_type: 4, sort_type: sortType, cursor, limit: 10,
    })
    if (data.err_no === 0) {
      pins = data.data || []
      const nextCursor = data.cursor || '0'
      pageCursors[currentPage] = nextCursor
      cursor = nextCursor
      if (pins.length === 0) errorMsg = '暂无数据，请按 r 刷新重试'
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

/** 下载图片并缓存，返回渲染后的字符串（失败返回 null） */
const getImageRendered = async (url, width) => {
  const cacheKey = `${url}@${width}`
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey)

  try {
    const buf = await fetchImageBuffer(url)
    let rendered

    if (useSixel) {
      const targetPx = typeof width === 'number' && width > 100 ? width : sixelWidth(width)
      const { data, info } = await sharp(buf)
        .resize({ width: targetPx, fit: 'inside' })
        .raw()
        .ensureAlpha()
        .toBuffer({ resolveWithObject: true })
      rendered = image2sixel(new Uint8Array(data), info.width, info.height)
    } else {
      rendered = await terminalImage.buffer(buf, { width })
    }

    imageCache.set(cacheKey, rendered)
    return rendered
  } catch (e) {
    imageCache.set(cacheKey, null)
    return null
  }
}

const renderPins = async () => {
  const lines = []
  lines.push(screenTopMarker())
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
    // 收集每个沸点的所有图片 URL
    const thumbWidth = useSixel ? Math.min(Math.floor(termCols() * 4), 400) : Math.min(Math.floor(termCols() * 0.3), 40)
    let allImageResults = []
    if (showImages) {
      const allImageTasks = pins.map((pin) => {
        const picUrls = picListUrls(pin.msg_Info?.pic_list)
        return picUrls.map((url) => getImageRendered(url, thumbWidth))
      })
      allImageResults = await Promise.all(
        allImageTasks.map((tasks) => Promise.all(tasks))
      )
    }

    // 渲染列表
    pins.forEach((pin, i) => {
      const author = pin.author_user_info?.user_name || '匿名'
      const content = pin.msg_Info?.content || '无内容'
      const cc = pin.msg_Info?.comment_count || 0
      const dc = pin.msg_Info?.digg_count || 0
      const time = formatTime(pin.msg_Info?.ctime)
      lines.push(`${c.yellow}[${i}]${c.reset} ${c.brightCyan}👤 ${author}${c.reset}`)
      lines.push(`    ${c.white}${content}${c.reset}`)

      // 显示图片或链接
      const picUrls = picListUrls(pin.msg_Info?.pic_list)
      if (picUrls.length > 0) {
        if (showImages) {
          const results = allImageResults[i]
          results.forEach((rendered) => {
            if (rendered) {
              lines.push(rendered)
            } else {
              lines.push(`    ${c.yellow}📷 图片加载失败${c.reset}`)
            }
          })
        } else {
          lines.push(`    ${c.yellow}📷 ${picUrls.length} 张图片${c.reset}`)
          picUrls.forEach((url, pi) => {
            lines.push(`    ${c.gray}${pi + 1}. ${url}${c.reset}`)
          })
        }
      }

      lines.push(`    ${c.gray}💬 ${cc} | 👍 ${dc} | ${time}${c.reset}`)
      lines.push('')
    })
  }

  lines.push(`${c.gray}─`.repeat(termCols()) + c.reset)
  lines.push(`${c.green}第 ${currentPage} 页${c.reset} | ${c.cyan}0-9${c.reset}详情 ${c.cyan}←→/ad${c.reset}翻页 ${c.cyan}r${c.reset}刷新 ${c.cyan}new/hot${c.reset}切换 ${c.cyan}img${c.reset}切换图片显示 ${c.cyan}exit${c.reset}退出`)
  lines.push(`${c.gray}─`.repeat(termCols()) + c.reset)
  lines.push(`${c.green}> ${c.reset}` + inputBuffer)
  paint(lines.join('\n'))
}

const renderDetail = async () => {
  const a = currentPin.author_user_info?.user_name || '匿名'
  const j = currentPin.author_user_info?.job_title || ''
  const content = currentPin.msg_Info?.content || '无内容'
  const cc = currentPin.msg_Info?.comment_count || 0
  const dc = currentPin.msg_Info?.digg_count || 0
  const picUrls = picListUrls(currentPin.msg_Info?.pic_list)

  const lines = []
  lines.push(screenTopMarker())
  lines.push(`${c.brightWhite}📖 沸点详情${c.reset}`)
  lines.push('')
  lines.push(`${c.brightCyan}👤 ${a}${j ? c.gray + ` (${j})` : ''}${c.reset}`)
  lines.push('')
  lines.push(`${c.white}${content}${c.reset}`)
  lines.push('')

  const imgWidth = useSixel ? Math.min(Math.floor(termCols() * 8), 800) : Math.min(Math.floor(termCols() * 0.8), 100)

  if (picUrls.length > 0) {
    if (showImages) {
      lines.push(`${c.yellow}📷 图片 (${picUrls.length} 张)${c.reset}`)
      const imageResults = await Promise.all(
        picUrls.map((url) => getImageRendered(url, imgWidth))
      )
      picUrls.forEach((url, i) => {
        const rendered = imageResults[i]
        if (rendered) {
          lines.push(rendered)
        } else {
          lines.push(`   ${c.gray}${i + 1}. ${url} (加载失败)${c.reset}`)
        }
      })
    } else {
      lines.push(`${c.yellow}📷 ${picUrls.length} 张图片${c.reset}`)
      picUrls.forEach((url, i) => {
        lines.push(`   ${c.gray}${i + 1}. ${url}${c.reset}`)
      })
    }
    lines.push('')
  }

  lines.push(`${c.yellow}💬 ${cc} | 👍 ${dc}${c.reset}`)
  lines.push('')

  if (comments.length) {
    lines.push(`${c.gray}─`.repeat(termCols()) + c.reset)
    lines.push(`${c.brightWhite}💬 评论 (${comments.length})${c.reset}`)
    lines.push(`${c.gray}─`.repeat(termCols()) + c.reset)

    // 预加载所有评论图片
    const commentImgWidth = imgWidth
    const commentImgMap = new Map()
    if (showImages) {
      const commentImgTasks = []
      comments.forEach((cm) => {
        const pics = cm.comment_info?.comment_pics || []
        pics.forEach((p) => {
          commentImgTasks.push({ id: cm.comment_id, url: p.pic_url, promise: getImageRendered(p.pic_url, commentImgWidth) })
        })
      })
      const commentImgResults = await Promise.all(commentImgTasks.map((t) => t.promise))
      commentImgTasks.forEach((t, i) => {
        if (!commentImgMap.has(t.id)) commentImgMap.set(t.id, [])
        if (commentImgResults[i]) commentImgMap.get(t.id).push(commentImgResults[i])
      })
    }

    comments.forEach((cm, i) => {
      const ca = cm.user_info?.user_name || '匿名'
      const cc2 = cm.comment_info?.comment_content || ''
      const cd = cm.comment_info?.digg_count || 0
      const commentId = cm.comment_id

      lines.push(`${c.yellow}${i + 1}.${c.reset} ${c.cyan}${ca}${c.reset}: ${c.white}${cc2}${c.reset} ${c.gray}👍${cd}${c.reset}`)

      // 显示评论图片或链接
      const pics = cm.comment_info?.comment_pics || []
      if (pics.length > 0) {
        if (showImages) {
          const cmImgs = commentImgMap.get(commentId) || []
          cmImgs.forEach((rendered) => lines.push(rendered))
        } else {
          pics.forEach((p, pi) => {
            lines.push(`   ${c.gray}${pi + 1}. ${p.pic_url}${c.reset}`)
          })
        }
      }

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

  lines.push(`${c.gray}─`.repeat(termCols()) + c.reset)
  lines.push(`${c.cyan}Tab/q${c.reset} 返回列表 | ${c.cyan}img${c.reset} 切换图片显示`)
  lines.push(`${c.gray}─`.repeat(termCols()) + c.reset)
  lines.push(`${c.green}> ${c.reset}` + inputBuffer)
  paint(lines.join('\n'))
}

const handle = async (cmd) => {
  if (currentPin) {
    if (cmd === 'q' || cmd === 'tab') {
      currentPin = null; comments = []; commentCursor = '0'; expandedReplies = {}
      inputBuffer = ''; await renderPins(); return
    }
    if (cmd.toLowerCase() === 'img') {
      showImages = !showImages
      inputBuffer = ''; await renderDetail(); return
    }
    inputBuffer = ''; await renderDetail(); return
  }

  const k = cmd.toLowerCase()

  if (k === 'exit') { process.stdout.write('\n👋 再见!\n'); process.exit(0) }
  if (k === 'r') {
    cursor = pageCursors[currentPage - 1] || '0'
    await fetchPins(); inputBuffer = ''; await renderPins(); return
  }
  if (k === 'new') {
    currentTab = 'new'; cursor = '0'; currentPage = 1; pageCursors = ['0']
    await fetchPins(); inputBuffer = ''; await renderPins(); return
  }
  if (k === 'hot') {
    currentTab = 'hot'; cursor = '0'; currentPage = 1; pageCursors = ['0']
    await fetchPins(); inputBuffer = ''; await renderPins(); return
  }
  if (k === 'img') {
    showImages = !showImages
    inputBuffer = ''
    await renderPins()
    return
  }
  if (k === '←' || k === 'left') {
    if (currentPage > 1) { currentPage--; cursor = pageCursors[currentPage - 1] || '0'; await fetchPins() }
    inputBuffer = ''; await renderPins(); return
  }
  if (k === '→' || k === 'right') {
    currentPage++; await fetchPins(); inputBuffer = ''; await renderPins(); return
  }

  const idx = parseInt(k)
  if (idx >= 0 && idx < pins.length) {
    currentPin = pins[idx]; comments = []; commentCursor = '0'; expandedReplies = {}
    inputBuffer = ''
    paint(`${c.cyan}⏳ 加载中...${c.reset}`)
    await fetchComments(currentPin.msg_id)
    await renderDetail()
  } else {
    inputBuffer = ''; await renderPins()
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

    // Tab 返回详情
    if (key === '\t') {
      if (currentPin) {
        isProcessing = true
        try { await handle('tab') } finally { isProcessing = false }
      }
      return
    }

    // Enter 处理输入缓冲区（保留给 new/hot 等文本命令）
    if (key === '\r' || key === '\n') {
      if (inputBuffer.trim()) {
        isProcessing = true
        try { await handle(inputBuffer.trim()) } finally { isProcessing = false }
      }
      return
    }

    // 退格
    if (key === '\b' || key === '\x7f') {
      if (inputBuffer.length) {
        inputBuffer = inputBuffer.slice(0, -1)
        process.stdout.write('\b \b')
      }
      return
    }

    // a/d 左右翻页
    if (key === '\u001b[D' || key === 'a' || key === 'A') {
      isProcessing = true
      try { await handle('←') } finally { isProcessing = false }
      return
    }
    if (key === '\u001b[C' || key === 'd' || key === 'D') {
      isProcessing = true
      try { await handle('→') } finally { isProcessing = false }
      return
    }

    // q 详情页直接返回，列表页进入输入缓冲
    if (key === 'q' || key === 'Q') {
      if (currentPin) {
        isProcessing = true
        try { await handle('q') } finally { isProcessing = false }
      } else {
        inputBuffer += key
        process.stdout.write(key)
      }
      return
    }

    // r 直接刷新当前页
    if (key === 'r' || key === 'R') {
      isProcessing = true
      try { await handle('r') } finally { isProcessing = false }
      return
    }

    // 0-9 直接跳转详情
    if (key >= '0' && key <= '9') {
      isProcessing = true
      try { await handle(key) } finally { isProcessing = false }
      return
    }

    // 其余字符进入输入缓冲区（用于 new/hot 等文本命令）
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
  await renderPins()
}

main()
