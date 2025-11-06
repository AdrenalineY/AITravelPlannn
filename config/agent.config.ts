/**
 * Agent 配置文件
 * 用于配置 ReAct Agent 的行为参数
 */

// 直接读取环境变量（必须使用静态字符串字面量，否则 Next.js 无法正确内联）
const MAX_TURNS_ENV = process.env.NEXT_PUBLIC_AGENT_MAX_TURNS || '10'
const WARNING_TURN_ENV = process.env.NEXT_PUBLIC_AGENT_WARNING_TURN || '8'

// 输出日志以便调试
console.log('[AgentConfig] Loading configuration:')
console.log(`  NEXT_PUBLIC_AGENT_MAX_TURNS = ${process.env.NEXT_PUBLIC_AGENT_MAX_TURNS}`)
console.log(`  NEXT_PUBLIC_AGENT_WARNING_TURN = ${process.env.NEXT_PUBLIC_AGENT_WARNING_TURN}`)
console.log(`  MAX_TURNS: ${MAX_TURNS_ENV}`)
console.log(`  WARNING_TURN: ${WARNING_TURN_ENV}`)

export const AgentConfig = {
  /**
   * Agent 最大运行轮次
   * 达到此轮次后,Agent 必须输出 Answer
   */
  MAX_TURNS: parseInt(MAX_TURNS_ENV, 10),

  /**
   * 强制输出答案的提示轮次
   * 达到此轮次时,会在 System Prompt 中提示 Agent 尽快完成规划
   */
  WARNING_TURN: parseInt(WARNING_TURN_ENV, 10),

  /**
   * 默认搜索半径 (米)
   */
  DEFAULT_SEARCH_RADIUS: 5000,

  /**
   * 是否在地点前自动添加城市名称
   */
  AUTO_ADD_CITY_PREFIX: true,
}

export default AgentConfig
