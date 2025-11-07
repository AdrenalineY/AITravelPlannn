/**
 * 行程 JSON 转自然语言 - 使用示例
 * 
 * 场景: 用户继续编辑已有行程
 */

import { itineraryJsonToText } from '../services/itineraryJsonToText'
import type { ItineraryCard } from '../types'

// ========== 示例 1: 基本使用 ==========

async function example1_basicUsage() {
  console.log('示例 1: 基本使用')
  console.log('='.repeat(60))
  
  // 假设从数据库加载了行程 JSON
  const itinerary: ItineraryCard = {
    id: '123',
    title: '上海3日游',
    destination: '上海',
    durationDays: 3,
    durationNights: 2,
    travelers: 2,
    preferences: ['美食', '文化'],
    days: [
      {
        dayNumber: 1,
        date: '2025-11-10',
        summary: '抵达上海,游览外滩',
        segments: [
          {
            order: 1,
            time: '10:00',
            type: 'activity',
            title: '游览外滩',
            location: '上海外滩',
            address: '上海市黄浦区中山东一路',
            description: '漫步外滩,欣赏万国建筑博览群',
            duration: 120,
            costEstimate: 0,
            costCategory: 'ticket'
          },
          {
            order: 2,
            time: '12:00',
            type: 'meal',
            title: '午餐',
            location: '老盛昌汤包馆',
            address: '上海市黄浦区南京东路XXX号',
            description: '品尝地道上海小笼包',
            duration: 60,
            costEstimate: 80,
            costCategory: 'meal',
            mealType: 'lunch',
            cuisine: '上海菜'
          }
        ]
      }
    ]
  }
  
  // 转换为自然语言
  const naturalText = await itineraryJsonToText.convertToNaturalLanguage(itinerary)
  
  console.log('转换结果:')
  console.log(naturalText)
  console.log()
}

// ========== 示例 2: 在 Agent 中使用 ==========

async function example2_inAgentContext() {
  console.log('示例 2: 在 Agent 中使用')
  console.log('='.repeat(60))
  
  // 从数据库加载行程
  const existingItinerary: ItineraryCard = {
    // ... (完整的行程数据)
  } as any
  
  // 转换为自然语言
  const naturalText = await itineraryJsonToText.convertToNaturalLanguage(existingItinerary)
  
  // 构建 Agent 上下文
  const conversationHistory = [
    {
      role: 'system',
      content: `【当前已有行程计划】
以下是用户当前的旅行行程安排,请在此基础上进行编辑、调整或优化:

${naturalText}

---
请基于用户的新需求,对上述行程进行相应的修改。保持原有合理的安排,只针对用户提出的问题进行调整。`
    },
    {
      role: 'user',
      content: '我想把第二天的行程改一下,增加一个迪士尼的游览'
    }
  ]
  
  console.log('Agent 上下文已准备就绪')
  console.log('对话历史长度:', conversationHistory.length)
  console.log('上下文文本长度:', naturalText.length, '字符')
  console.log()
  
  // 接下来 Agent 就可以基于这个上下文进行规划了
  // const result = await agent.run(userMessage)
}

// ========== 示例 3: 错误处理和降级 ==========

async function example3_errorHandling() {
  console.log('示例 3: 错误处理和降级')
  console.log('='.repeat(60))
  
  const itinerary: ItineraryCard = {
    // ... (行程数据)
  } as any
  
  try {
    // 优先使用 AI 转换
    console.log('尝试 AI 转换...')
    const naturalText = await itineraryJsonToText.convertToNaturalLanguage(itinerary)
    console.log('✅ AI 转换成功')
    return naturalText
  } catch (error) {
    // 降级到同步方案
    console.log('⚠️  AI 转换失败,使用降级方案')
    const naturalText = itineraryJsonToText.convertToNaturalLanguageSync(itinerary)
    console.log('✅ 降级方案完成')
    return naturalText
  }
}

// ========== 示例 4: 仅使用同步方案(快速预览) ==========

function example4_syncOnly() {
  console.log('示例 4: 仅使用同步方案(快速预览)')
  console.log('='.repeat(60))
  
  const itinerary: ItineraryCard = {
    // ... (行程数据)
  } as any
  
  // 同步转换,不需要 await
  const startTime = Date.now()
  const naturalText = itineraryJsonToText.convertToNaturalLanguageSync(itinerary)
  const duration = Date.now() - startTime
  
  console.log(`✅ 转换完成,耗时 ${duration}ms`)
  console.log(`📝 文本长度: ${naturalText.length} 字符`)
  console.log()
  console.log(naturalText.substring(0, 500) + '...')
}

// ========== 示例 5: API 路由中的完整流程 ==========

async function example5_fullWorkflow() {
  console.log('示例 5: API 路由中的完整流程')
  console.log('='.repeat(60))
  
  // 模拟 API 请求处理
  const sessionGroupId = 'session-123'
  const userId = 'user-456'
  
  // 1. 从数据库加载行程
  console.log('1️⃣  从数据库加载行程...')
  // const itinerary = await loadItineraryFromDB(sessionGroupId, userId)
  const itinerary: ItineraryCard = {} as any
  console.log('   ✅ 行程加载成功')
  
  // 2. 转换为自然语言
  console.log('2️⃣  转换为自然语言...')
  let naturalText: string
  try {
    naturalText = await itineraryJsonToText.convertToNaturalLanguage(itinerary)
    console.log('   ✅ AI 转换成功')
  } catch (error) {
    naturalText = itineraryJsonToText.convertToNaturalLanguageSync(itinerary)
    console.log('   ⚠️  使用降级方案')
  }
  
  // 3. 构建 Agent 上下文
  console.log('3️⃣  构建 Agent 上下文...')
  const conversationHistory = [
    {
      role: 'system',
      content: `【当前已有行程计划】\n${naturalText}\n---\n请基于用户的新需求进行调整。`
    }
  ]
  console.log('   ✅ 上下文已准备')
  
  // 4. 创建 Agent 并运行
  console.log('4️⃣  创建 Agent 并运行...')
  // const agent = await createReactAgent(sessionGroupId, userId)
  // const result = await agent.run(userMessage)
  console.log('   ✅ Agent 运行完成')
  
  // 5. 返回结果
  console.log('5️⃣  返回结果给前端')
  console.log()
  console.log('✅ 完整流程执行成功')
}

// ========== 运行所有示例 ==========

async function runAllExamples() {
  console.log('\n')
  console.log('╔' + '═'.repeat(78) + '╗')
  console.log('║' + ' '.repeat(20) + '行程 JSON 转自然语言 - 使用示例' + ' '.repeat(25) + '║')
  console.log('╚' + '═'.repeat(78) + '╝')
  console.log('\n')
  
  // 注意: 示例1和2需要配置 LLM API 才能运行
  // 示例4可以直接运行(同步方案)
  
  // await example1_basicUsage()
  // await example2_inAgentContext()
  // await example3_errorHandling()
  example4_syncOnly()
  // await example5_fullWorkflow()
  
  console.log('\n')
  console.log('═'.repeat(80))
  console.log('💡 提示:')
  console.log('- 示例 1-3, 5 需要配置 LLM API 才能运行')
  console.log('- 示例 4 可以直接运行(不需要 API)')
  console.log('- 完整测试请运行: npm run test:json-to-text')
  console.log('═'.repeat(80))
}

// 如果直接运行此文件
if (require.main === module) {
  runAllExamples().catch(console.error)
}

export {
  example1_basicUsage,
  example2_inAgentContext,
  example3_errorHandling,
  example4_syncOnly,
  example5_fullWorkflow
}
