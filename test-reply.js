#!/usr/bin/env node
import axios from 'axios'

const test = async () => {
  // 获取沸点
  const r = await axios.post('https://api.juejin.cn/recommend_api/v1/short_msg/recommend', {
    id_type: 4, sort_type: 300, cursor: '0', limit: 10
  })
  
  // 找有评论的沸点
  for (const pin of r.data.data) {
    if (pin.msg_Info.comment_count > 0) {
      console.log('沸点:', pin.msg_id, '评论数:', pin.msg_Info.comment_count)
      
      // 获取评论
      const r2 = await axios.post('https://api.juejin.cn/interact_api/v1/comment/list', {
        cursor: '0', limit: 10, item_id: pin.msg_id, item_type: 4, sort_type: 200
      })
      
      // 查看评论结构
      for (const c of r2.data.data) {
        console.log('\n评论:', c.comment_info.comment_content)
        console.log('回复数:', c.comment_info.reply_count)
        if (c.reply_infos && c.reply_infos.length > 0) {
          console.log('reply_infos:', JSON.stringify(c.reply_infos, null, 2))
        }
      }
      break
    }
  }
}

test()