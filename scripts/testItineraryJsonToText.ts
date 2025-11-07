/**
 * 测试 ItineraryJsonToText 服务
 * 使用 test_timeline_sample2.json 作为测试数据
 */

import fs from 'fs'
import path from 'path'
import { itineraryJsonToText } from '../services/itineraryJsonToText'
import type { ItineraryCard } from '../types'

async function main() {
  console.log('='.repeat(80))
  console.log('行程 JSON 转自然语言文本 - 测试')
  console.log('='.repeat(80))
  console.log()

  // 读取测试数据
  const testDataPath = path.join(process.cwd(), 'test_timeline_sample2.json')
  console.log('📂 加载测试数据:', testDataPath)
  
  const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf-8')) as ItineraryCard
  console.log(`✅ 加载成功: ${testData.title}`)
  console.log(`   目的地: ${testData.destination}`)
  console.log(`   时长: ${testData.durationDays}天${testData.durationNights}晚`)
  console.log(`   人数: ${testData.travelers}人`)
  console.log(`   预算: ${testData.totalBudget}元`)
  console.log()

  // 测试 1: 同步转换
  console.log('🧪 测试 1: 同步转换 (直接拼接,速度快)')
  console.log('-'.repeat(80))
  const syncStartTime = Date.now()
  const syncResult = itineraryJsonToText.convertToNaturalLanguageSync(testData)
  const syncDuration = Date.now() - syncStartTime
  
  console.log(`⏱️  耗时: ${syncDuration}ms`)
  console.log(`📝 文本长度: ${syncResult.length} 字符`)
  console.log()
  console.log('📄 转换结果 (前 2000 字符):')
  console.log('─'.repeat(80))
  console.log(syncResult.substring(0, 2000))
  if (syncResult.length > 2000) {
    console.log(`\n... (还有 ${syncResult.length - 2000} 字符)`)
  }
  console.log('─'.repeat(80))
  console.log()

  // 测试 2: 异步转换 (现在也使用拼接方式,速度同样快)
  console.log('🧪 测试 2: 异步转换 (也使用拼接方式,不调用 LLM)')
  console.log('-'.repeat(80))
  
  const asyncStartTime = Date.now()
  const asyncResult = await itineraryJsonToText.convertToNaturalLanguage(testData)
  const asyncDuration = Date.now() - asyncStartTime
  
  console.log(`⏱️  耗时: ${asyncDuration}ms`)
  console.log(`📝 文本长度: ${asyncResult.length} 字符`)
  console.log()
  console.log('📄 转换结果 (前 2000 字符):')
  console.log('─'.repeat(80))
  console.log(asyncResult.substring(0, 2000))
  if (asyncResult.length > 2000) {
    console.log(`\n... (还有 ${asyncResult.length - 2000} 字符)`)
  }
  console.log('─'.repeat(80))
  console.log()

  // 保存完整输出到文件
  const outputPath = path.join(process.cwd(), 'test_itinerary_to_text_output.txt')
  fs.writeFileSync(outputPath, `# JSON 转自然语言测试结果\n\n测试时间: ${new Date().toLocaleString()}\n\n${'='.repeat(80)}\n\n${syncResult}`, 'utf-8')
  console.log(`💾 完整输出已保存到: ${outputPath}`)

  console.log()
  console.log('='.repeat(80))
  console.log('✅ 测试完成')
  console.log('='.repeat(80))
}

main().catch(error => {
  console.error('❌ 测试失败:', error)
  process.exit(1)
})
