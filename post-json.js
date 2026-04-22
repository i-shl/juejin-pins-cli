/** POST JSON，带超时；返回解析后的响应体对象 */
export async function postJson(url, body, timeoutMs = 10_000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    const text = await res.text()
    try {
      return text ? JSON.parse(text) : {}
    } catch {
      throw new Error(`无效 JSON 响应 (HTTP ${res.status})`)
    }
  } finally {
    clearTimeout(timer)
  }
}

/** 与 cli 中 fetch 失败提示一致 */
export function formatFetchError(err) {
  if (err.name === 'AbortError') {
    return '网络超时，请检查网络后按 s 刷新'
  }
  const code = err.cause?.code ?? err.code
  if (code === 'ENOTFOUND' || code === 'ECONNREFUSED') {
    return '无法连接服务器，请检查网络后按 s 刷新'
  }
  return '网络请求失败: ' + (err.message || String(err))
}
