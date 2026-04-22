#!/usr/bin/env node
/**
 * 掘金沸点 CLI 浏览器 - 测试脚本
 * 用于验证API连接和基本功能
 */

import axios from 'axios'

const API_URL = 'https://api.juejin.cn/recommend_api/v1/short_msg/recommend'

const testApiConnection = async () => {
  console.log('🔍 测试掘金沸点API连接...')
  
  try {
    const response = await axios.post(API_URL, {
      id_type: 4,
      sort_type: 300,
      cursor: '0',
      limit: 5
    })
    
    if (response.data.err_no === 0) {
      console.log('✅ API连接成功!')
      console.log(`📊 获取到 ${response.data.data?.length || 0} 条沸点数据`)
      
      if (response.data.data && response.data.data.length > 0) {
        const pin = response.data.data[0]
        console.log('\n📝 第一条沸点预览:')
        console.log(`👤 作者: ${pin.author_user_info?.user_name || '未知'}`)
        console.log(`📄 内容: ${(pin.msg_Info?.content || '无内容').substring(0, 50)}...`)
        console.log(`💬 评论: ${pin.msg_Info?.comment_count || 0}`)
        console.log(`👍 点赞: ${pin.msg_Info?.digg_count || 0}`)
      }
      
      return true
    } else {
      console.log('❌ API返回错误:', response.data.err_msg)
      return false
    }
  } catch (error) {
    console.log('❌ API连接失败:', error.message)
    return false
  }
}

const main = async () => {
  console.log('🚀 掘金沸点 CLI 浏览器 - 测试工具')
  console.log('='.repeat(50))
  
  const success = await testApiConnection()
  
  console.log('\n' + '='.repeat(50))
  if (success) {
    console.log('✅ 测试完成！CLI工具可以正常使用。')
    console.log('\n📖 使用方法:')
    console.log('   node cli.js')
  } else {
    console.log('❌ 测试失败！请检查网络连接。')
  }
}

main()