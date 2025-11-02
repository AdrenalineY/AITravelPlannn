/**
 * Agent 配置文件
 * 用于配置 ReAct Agent 的行为参数
 */

export const AgentConfig = {
  /**
   * Agent 最大运行轮次
   * 达到此轮次后,Agent 必须输出 Answer
   */
  MAX_TURNS: parseInt(process.env.NEXT_PUBLIC_AGENT_MAX_TURNS || '10', 10),

  /**
   * 强制输出答案的提示轮次
   * 达到此轮次时,会在 System Prompt 中提示 Agent 尽快完成规划
   */
  WARNING_TURN: parseInt(process.env.NEXT_PUBLIC_AGENT_WARNING_TURN || '8', 10),

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
