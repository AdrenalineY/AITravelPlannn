/**
 * 环境变量测试脚本
 * 用于验证 Agent 配置是否正确加载
 * 
 * 运行方式: node -r dotenv/config scripts/test-env.js
 */

console.log('\n=== Agent 环境变量测试 ===\n')

console.log('原始环境变量:')
console.log(`  process.env.NEXT_PUBLIC_AGENT_MAX_TURNS = "${process.env.NEXT_PUBLIC_AGENT_MAX_TURNS}"`)
console.log(`  process.env.NEXT_PUBLIC_AGENT_WARNING_TURN = "${process.env.NEXT_PUBLIC_AGENT_WARNING_TURN}"`)

console.log('\n解析后的值:')
const maxTurns = parseInt(process.env.NEXT_PUBLIC_AGENT_MAX_TURNS || '10', 10)
const warningTurn = parseInt(process.env.NEXT_PUBLIC_AGENT_WARNING_TURN || '8', 10)

console.log(`  MAX_TURNS: ${maxTurns}`)
console.log(`  WARNING_TURN: ${warningTurn}`)

console.log('\n期望值:')
console.log('  MAX_TURNS: 7')
console.log('  WARNING_TURN: 5')

console.log('\n验证结果:')
if (maxTurns === 7 && warningTurn === 5) {
  console.log('  ✅ 环境变量配置正确！')
} else {
  console.log('  ❌ 环境变量配置错误！')
  console.log('  请检查:')
  console.log('    1. .env.local 文件是否正确')
  console.log('    2. 是否重启了开发服务器')
  console.log('    3. 是否清除了 .next 缓存')
}

console.log('\n')
