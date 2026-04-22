#!/usr/bin/env node
import axios from 'axios'

const test = async () => {
  // 获取一个有评论的沸点
  const r = await axios.post('https://api.juejin.cn/recommend_api/v1/short_msg/recommend', {
    id_type: 4, sort_type: 300, cursor: '0', limit: 10
  })
  
  for (const pin of r.data.data) {
    if (pin.msg_Info.comment_count > 5) {
      console.log('沸点:', pin.msg_id, '评论数:', pin.msg_Info.comment_count)
      
      // 获取评论
      const r2 = await axios.post('https://api.juejin.cn/interact_api/v1/comment/list', {
        cursor: '0', limit: 10, item_id: pin.msg_id, item_type: 4, sort_type: 200
      })
      
      // 找一个回复数大于2的评论
      for (const c of r2.data.data) {
        if (c.comment_info.reply_count > 2) {
          console.log('\n评论ID:', c.comment_id)
          console.log('评论内容:', c.comment_info.comment_content)
          console.log('回复数:', c.comment_info.reply_count)
          console.log('reply_infos数量:', c.reply_infos?.length || 0)
          
          // 尝试获取回复列表
          console.log('\n尝试获取回复列表...')
          try {
            const r3 = await axios.post('https://api.juejin.cn/interact_api/v1/reply/list', {
              cursor: '0',
              limit: 20,
              comment_id: c.comment_id,
              item_id: pin.msg_id,
              item_type: 4,
              sort_type: 200
            })
            console.log('回复API响应:', JSON.stringify(r3.data, null, 2).substring(0, 1000))
          } catch (e) {
            console.log('回复API失败:', e.response?.data || e.message)
          }
          break
        }
      }
      break
    }
  }
}

test()