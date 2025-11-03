/**
 * 环境变量调试工具
 * 用于检查 Agent 配置是否正确加载
 */

import AgentConfig from '@/config/agent.config'

export function debugAgentConfig() {
  console.log('='.repeat(60))
  console.log('🔍 Agent Configuration Debug Info')
  console.log('='.repeat(60))
  
  console.log('\n📋 Environment Variables (Raw):')
  console.log('  NEXT_PUBLIC_AGENT_MAX_TURNS:', process.env.NEXT_PUBLIC_AGENT_MAX_TURNS)
  console.log('  NEXT_PUBLIC_AGENT_WARNING_TURN:', process.env.NEXT_PUBLIC_AGENT_WARNING_TURN)
  
  console.log('\n⚙️  Loaded AgentConfig:')
  console.log('  MAX_TURNS:', AgentConfig.MAX_TURNS)
  console.log('  WARNING_TURN:', AgentConfig.WARNING_TURN)
  console.log('  DEFAULT_SEARCH_RADIUS:', AgentConfig.DEFAULT_SEARCH_RADIUS)
  console.log('  AUTO_ADD_CITY_PREFIX:', AgentConfig.AUTO_ADD_CITY_PREFIX)
  
  console.log('\n✅ Type Check:')
  console.log('  typeof MAX_TURNS:', typeof AgentConfig.MAX_TURNS)
  console.log('  typeof WARNING_TURN:', typeof AgentConfig.WARNING_TURN)
  
  console.log('\n⚠️  Issue Detection:')
  if (AgentConfig.MAX_TURNS === 10) {
    console.log('  ❌ MAX_TURNS is still default (10) - Environment variable not loaded!')
  } else {
    console.log('  ✅ MAX_TURNS loaded from environment:', AgentConfig.MAX_TURNS)
  }
  
  if (AgentConfig.WARNING_TURN === 8) {
    console.log('  ❌ WARNING_TURN is still default (8) - Environment variable not loaded!')
  } else {
    console.log('  ✅ WARNING_TURN loaded from environment:', AgentConfig.WARNING_TURN)
  }
  
  console.log('='.repeat(60))
}

// 导出用于在其他地方调用
export default debugAgentConfig
