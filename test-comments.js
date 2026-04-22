#!/usr/bin/env node
/**
 * 测试评论功能
 */

import axios from 'axios'

const PINS_API_URL = 'https://api.juejin.cn/recommend_api/v1/short_msg/recommend'
const COMMENTS_API_URL = 'https://api.juejin.cn/interact_api/v1/comment/list'

const testComments = async () => {
  console.log('🔍 测试掘金沸点评论功能...')
  
  try {
    // 先获取沸点
    const pinsResponse = await axios.post(PINS_API_URL, {
      id_type: 4,
      sort_type: 300,
      cursor: '0',
      limit: 1
    })
    
    if (pinsResponse.data.err_no !== 0) {
      console.log('❌ 获取沸点失败:', pinsResponse.data.err_msg)
      return false
    }
    
    const pin = pinsResponse.data.data[0]
    console.log(`✅ 获取到沸点: ${pin.msg_id}`)
    console.log(`👤 作者: ${pin.author_user_info?.user_name}`)
    console.log(`💬 评论数: ${pin.msg_Info?.comment_count}`)
    
    // 获取评论
    const commentsResponse = await axios.post(COMMENTS_API_URL, {
      cursor: '0',
      limit: 10,
      item_id: pin.msg_id,
      item_type: 4,
      sort_type: 200
    })
    
    if (commentsResponse.data.err_no !== 0) {
      console.log('❌ 获取评论失败:', commentsResponse.data.err_msg)
      return false
    }
    
    const comments = commentsResponse.data.data || []
    console.log(`✅ 获取到 ${comments.length} 条评论`)
    
    if (comments.length > 0) {
      console.log('\n📝 第一条评论:')
      const comment = comments[0]
      console.log(`👤 评论者: ${comment.user_info?.user_name || '匿名'}`)
      console.log(`💬 内容: ${comment.comment_info?.comment_content || '无内容'}`)
      console.log(`👍 点赞数: ${comment.comment_info?.digg_count || 0}`)
    }
    
    return true
  } catch (error) {
    console.log('❌ 测试失败:', error.message)
    return false
  }
}

const main = async () => {
  console.log('🚀 掘金沸点评论功能测试')
  console.log('='.repeat(50))
  
  const success = await testComments()
  
  console.log('\n' + '='.repeat(50))
  if (success) {
    console.log('✅ 测试完成！评论功能正常。')
  } else {
    console.log('❌ 测试失败！')
  }
}

main()