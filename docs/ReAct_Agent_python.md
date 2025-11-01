# ReAct Agent Python 实现

## 样例代码

```python
import re
import json
import time
from typing import Dict, List, Optional, Tuple, Any

class TravelPlanningAgent:
    def __init__(self, conversation_history: Optional[List] = None, user_preferences: Optional[Dict] = None):
        # 系统提示词
        self.system_prompt = """
你是一个专业的旅行规划AI助手。
你运行在: Thought → Action → PAUSE → Observation 的循环中
当你认为基于用户当前提供信息，你的旅行规划已经完整时，你输出 Answer
用 Thought 分析当前信息。使用 Action 运行您可用的操作之一，然后返回 PAUSE。Observation 是运行 Action 后的结果。

## 可用工具
1. calculate_distance:
   - 格式: calculate_distance: 起点, 终点, 交通方式
   - 用途: 计算两地距离、时间和交通费用

2. search_nearby:
   - 格式: search_nearby: 地点, 类别, 半径
   - 类别: 景点、餐饮、住宿
   - 用途: 搜索附近的POI信息

3. estimate_cost:
   - 格式: estimate_cost: 项目类型, 详细信息
   - 用途: 估算各项费用

## Thought 原则
1. 分析对话历史和当前需求
2. 识别缺失的关键信息
3. 考虑用户偏好和约束条件
4. 规划合理的行程逻辑

## Action 策略
- 当需要两处地点之间的交通行程信息时 - 使用calculate_distance
- 当需要一处地点附近的景点、餐饮、住宿信息时 - 使用search_nearby
- 当需要费用信息时 - 使用estimate_cost  

## 输出要求
最终Answer必须包含:
1. 完整的旅行计划(自然语言)
2. 明确的下一步问题引导用户提供更多细节
"""
        
        # 初始化消息列表
        self.messages = [{"role": "system", "content": self.system_prompt}]
        
        # 对话历史和用户偏好
        self.conversation_history = conversation_history or []
        self.user_preferences = user_preferences or {}
        self.current_plan = {}
        
        # 工具实例
        self.tools = TravelTools()
        
        # 注册可用动作
        self.known_actions = {
            "calculate_distance": self.tools.calculate_distance,
            "search_nearby": self.tools.search_nearby,
            "estimate_cost": self.tools.estimate_cost,
        }

    def __call__(self, message: str, max_turns: int = 10) -> str:
        """运行完整的ReAct循环"""
        # 构建上下文并添加到消息中
        context_message = self._build_context(message)
        self.messages.append({"role": "user", "content": context_message})
        
        # 记录当前对话
        self.conversation_history.append({"role": "user", "content": message})
        
        for turn in range(max_turns):
            # 执行LLM调用
            result = self._execute_llm()
            print(f"=== Turn {turn + 1} ===")
            print(result)
            
            # 解析行动
            action_match = self._parse_action(result)
            if action_match:
                action, action_input = action_match
                observation = self._run_action(action, action_input)
                print(f"Action: {action}")
                print(f"Input: {action_input}")
                print(f"Observation: {observation}")
                
                # 添加观察到消息中
                self.messages.append({"role": "user", "content": f"Observation: {observation}"})
            else:
                # 没有行动，输出最终答案
                final_response = self._extract_final_answer(result)
                self._save_plan_structure()
                
                # 记录Agent回复
                self.conversation_history.append({"role": "assistant", "content": final_response})
                return final_response
                
        timeout_message = "抱歉，规划过程超时，请重新尝试。"
        self.conversation_history.append({"role": "assistant", "content": timeout_message})
        return timeout_message
    
    def _build_context(self, current_message: str) -> str:
        """构建包含历史对话和偏好的上下文"""
        context = f"""
当前用户输入: {current_message}

对话历史:
{self._format_conversation_history()}

用户偏好信息:
{self._format_user_preferences()}

当前旅行计划状态:
{json.dumps(self.current_plan, ensure_ascii=False, indent=2) if self.current_plan else "暂无计划"}
"""
        return context
    
    def _format_conversation_history(self) -> str:
        """格式化对话历史"""
        if not self.conversation_history:
            return "无历史对话"
        
        formatted = []
        for i, msg in enumerate(self.conversation_history[-5:]):  # 只保留最近5轮
            role = "用户" if msg["role"] == "user" else "助手"
            formatted.append(f"{role}: {msg['content']}")
        return "\n".join(formatted)
    
    def _format_user_preferences(self) -> str:
        """格式化用户偏好信息"""
        if not self.user_preferences:
            return "无用户偏好信息"
        return json.dumps(self.user_preferences, ensure_ascii=False, indent=2)
    
    def _execute_llm(self) -> str:
        """执行LLM调用"""
        # 这里应该调用实际的LLM API
        # 为了演示，我们返回一个模拟响应
        try:
            # 模拟LLM响应 - 在实际使用中替换为真实的API调用
            response = self._mock_llm_call()
            return response
        except Exception as e:
            return f"LLM调用错误: {str(e)}"
    
    def _mock_llm_call(self) -> str:
        pass
        """模拟LLM调用 - 在实际使用中替换为真实的API调用"""
        # 这里应该调用真实的LLM API
        # 例如: 
        # response = client.chat.completions.create(
        #     model="qwen-max",
        #     messages=self.messages
        # )
        # return response.choices[0].message.content
        
    
    def _parse_action(self, result: str) -> Optional[Tuple[str, str]]:
        """解析行动指令"""
        action_re = re.compile(r'^Action: (\w+): (.*)$', re.MULTILINE)
        match = action_re.search(result)
        if match:
            return match.groups()
        return None
    
    def _run_action(self, action: str, action_input: str) -> str:
        """执行工具调用"""
        if action in self.known_actions:
            try:
                # 根据不同的action解析输入参数
                if action == "calculate_distance":
                    params = [p.strip() for p in action_input.split(',')]
                    return self.known_actions[action](*params)
                elif action == "search_nearby":
                    params = [p.strip() for p in action_input.split(',')]
                    return self.known_actions[action](*params)
                elif action == "estimate_cost":
                    # 尝试解析JSON输入
                    try:
                        params = json.loads(action_input)
                        item_type = params.get('type', '未知类型')
                        return self.known_actions[action](item_type, params)
                    except json.JSONDecodeError:
                        # 如果不是JSON，尝试其他解析方式
                        parts = action_input.split(',', 1)
                        if len(parts) == 2:
                            item_type, details = parts
                            return self.known_actions[action](item_type.strip(), details.strip())
                        else:
                            return self.known_actions[action]("未知类型", action_input)
            except Exception as e:
                return f"工具执行错误: {str(e)}"
        return f"未知行动: {action}"
    
    def _extract_final_answer(self, result: str) -> str:
        """提取最终答案并保存计划"""
        # 查找Answer部分
        answer_re = re.compile(r'Answer:\s*(.*)', re.DOTALL)
        match = answer_re.search(result)
        if match:
            answer = match.group(1).strip()
            # 如果没有明确的Answer部分，使用整个结果
            if not answer:
                answer = result
        else:
            answer = result
        
        # 提取结构化计划
        try:
            plan_structure = self.tools.extract_plan_structure(answer)
            self.current_plan = json.loads(plan_structure)
        except Exception as e:
            print(f"计划提取失败: {e}")
            # 即使提取失败，也保存基本信息
            self.current_plan = {
                "destination": "未知",
                "duration": 0,
                "total_budget": 0,
                "raw_plan": answer
            }
        
        return answer
    
    def _save_plan_structure(self) -> Optional[str]:
        """保存结构化计划到数据库"""
        if self.current_plan:
            # 这里添加保存到数据库的逻辑
            plan_id = f"plan_{int(time.time())}"
            self.current_plan['plan_id'] = plan_id
            self.current_plan['created_at'] = time.time()
            self.current_plan['user_preferences'] = self.user_preferences
            
            # 在实际应用中保存到数据库
            # save_to_database(plan_id, self.current_plan)
            print(f"计划已保存: {plan_id}")
            return plan_id
        return None
    
    def update_user_preferences(self, new_preferences: Dict):
        """更新用户偏好信息"""
        self.user_preferences.update(new_preferences)
    
    def get_current_plan(self) -> Dict:
        """获取当前旅行计划"""
        return self.current_plan
    
    def clear_conversation_history(self):
        """清空对话历史"""
        self.conversation_history = []


class TravelTools:
    """独立的工具类，包含所有可用的工具函数"""
    
    @staticmethod
    def calculate_distance(origin: str, destination: str, mode: str = "driving") -> str:
        """计算两地距离和交通时间"""
        # 模拟高德地图API调用
        # 实际实现应该调用真实的高德地图API
        simulations = {
            ("东京站", "浅草寺"): {"distance": "5km", "duration": "20分钟", "cost": "300日元"},
            ("浅草寺", "秋叶原"): {"distance": "3km", "duration": "15分钟", "cost": "200日元"},
            ("秋叶原", "新宿"): {"distance": "8km", "duration": "25分钟", "cost": "350日元"}
        }
        
        key = (origin, destination)
        if key in simulations:
            result = simulations[key]
            return json.dumps(result, ensure_ascii=False)
        else:
            return json.dumps({
                "distance": "10km", 
                "duration": "30分钟", 
                "cost": "500日元",
                "note": "模拟数据"
            }, ensure_ascii=False)
    
    @staticmethod
    def search_nearby(location: str, category: str, radius: int = 5000) -> str:
        """搜索附近地点"""
        # 模拟高德地图API调用
        categories = {
            "景点": [
                {"name": "浅草寺", "type": "文化古迹", "rating": 4.7, "address": "东京都台东区"},
                {"name": "东京塔", "type": "观景台", "rating": 4.5, "address": "东京都港区"},
                {"name": "上野公园", "type": "公园", "rating": 4.3, "address": "东京都台东区"}
            ],
            "餐饮": [
                {"name": "一兰拉面", "type": "拉面", "rating": 4.6, "price_level": "中等"},
                {"name": "蟹道乐", "type": "海鲜", "rating": 4.4, "price_level": "高档"},
                {"name": "矶丸水产", "type": "海鲜", "rating": 4.2, "price_level": "中等"}
            ],
            "住宿": [
                {"name": "东京帝国酒店", "type": "豪华酒店", "rating": 4.8, "price_range": "1500-3000元"},
                {"name": "APA酒店", "type": "商务酒店", "rating": 4.0, "price_range": "400-800元"},
                {"name": "东京青年旅舍", "type": "青年旅舍", "rating": 4.1, "price_range": "200-400元"}
            ]
        }
        
        if category in categories:
            results = categories[category]
            return json.dumps({
                "location": location,
                "category": category,
                "results": results,
                "count": len(results)
            }, ensure_ascii=False)
        else:
            return json.dumps({
                "error": f"未知类别: {category}",
                "available_categories": list(categories.keys())
            }, ensure_ascii=False)
    
    @staticmethod
    def estimate_cost(item_type: str, details: Any) -> str:
        """估算费用"""
        # 模拟LLM费用估算
        cost_estimates = {
            "餐饮": {"budget": "1500-2500元", "details": "包含5天餐饮费用，中等餐厅"},
            "住宿": {"budget": "2400元", "details": "4晚中等酒店，双人间"},
            "交通": {"budget": "800元", "details": "包含地铁、公交和少量出租车"},
            "景点": {"budget": "1000元", "details": "主要景点门票费用"},
            "购物": {"budget": "800元", "details": "纪念品和日常购物"}
        }
        
        if item_type in cost_estimates:
            estimate = cost_estimates[item_type]
            return json.dumps({
                "item": item_type,
                "estimated_cost": estimate["budget"],
                "details": estimate["details"],
                "reasoning": f"基于{item_type}的标准市场价格估算"
            }, ensure_ascii=False)
        else:
            return json.dumps({
                "item": item_type,
                "estimated_cost": "1000元",
                "reasoning": "通用估算，建议提供更多详细信息"
            }, ensure_ascii=False)
    
    @staticmethod
    def extract_plan_structure(natural_language_plan: str) -> str:
        """从自然语言计划中提取结构化数据"""
        # 模拟从自然语言提取结构化数据
        # 在实际应用中，这里应该调用LLM进行智能提取
        
        # 简单解析示例
        plan_data = {
            "destination": "东京",
            "duration": 5,
            "total_budget": 10000,
            "travelers": 2,
            "daily_itinerary": [
                {
                    "day": 1,
                    "theme": "抵达与浅草文化体验",
                    "activities": [
                        {
                            "time": "上午",
                            "location": "羽田机场",
                            "activity": "抵达并前往酒店",
                            "transportation": "机场大巴",
                            "cost": 100,
                            "notes": "建议提前预订接机"
                        }
                    ]
                }
            ],
            "budget_breakdown": {
                "accommodation": 2400,
                "transportation": 800,
                "food": 2000,
                "activities": 1000,
                "shopping": 800,
                "flight": 3000
            },
            "raw_plan": natural_language_plan[:500]  # 保存部分原始计划
        }
        
        return json.dumps(plan_data, ensure_ascii=False)


# 使用示例
if __name__ == "__main__":
    # 初始化Agent
    agent = TravelPlanningAgent()
    
    # 第一轮对话
    print("用户: 我想去东京玩5天，预算1万元")
    response1 = agent("我想去东京玩5天，预算1万元")
    print(f"Agent: {response1}")
    
    print("\n" + "="*50 + "\n")
    
    # 第二轮对话
    print("用户: 我喜欢美食和动漫")
    response2 = agent("我喜欢美食和动漫")
    print(f"Agent: {response2}")
    
    print("\n" + "="*50 + "\n")
    
    # 查看最终生成的计划
    final_plan = agent.get_current_plan()
    print("生成的旅行计划结构:")
    print(json.dumps(final_plan, ensure_ascii=False, indent=2))
```


## 会话样例

### 第一次Agent运行：

**用户**: 我想去东京玩5天，预算2万元

**Agent Thought**: 用户提供了目的地、天数和预算，但缺少具体偏好、同行人数和旅行日期等信息。我需要先搜索东京的主要景点信息，然后询问用户的详细偏好。
**Agent Action**: search_nearby: 东京, 景点, 10km
**PAUSE**

**Observation**: [返回东京景点列表：浅草寺、东京塔、上野公园等]

**Agent Thought**: 现在有了东京的景点信息，但我需要了解用户的具体偏好来推荐合适的景点组合。同时需要估算交通费用来规划预算。
**Agent Action**: calculate_distance: 东京站, 浅草寺, 地铁
**PAUSE**

**Observation**: [返回距离信息：5km, 20分钟, 300日元]

**Agent Thought**: 了解了景点间的交通情况，现在需要估算整体费用并生成初步计划。我需要询问用户更多细节来完善计划。
**Agent Action**: estimate_cost: 住宿, {"location": "东京", "nights": 4, "level": "中等"}
**PAUSE**

**Observation**: [返回住宿费用估算：2400元]

**Agent Answer**: 我为您初步规划了东京5日游的框架！[...详细计划...] 为了完善您的行程，请告诉我：1. 您的具体旅行日期是什么时候？2. 有几位同行人员？...

------

### 用户反馈后开始第二次Agent运行：

**用户**: 我们夫妻两人，计划6月15日出发，喜欢美食和购物，希望住在交通便利的地方

**Agent Thought**: 用户提供了具体日期和同行人数，现在可以规划详细的每日行程了。需要搜索东京市中心的餐饮和购物地点，并计算关键路线的时间。
**Agent Action**: search_nearby: 东京市中心, 餐饮, 3km
**PAUSE**

**Observation**: [返回餐饮信息：一兰拉面、蟹道乐等]

**Agent Thought**: 有了餐饮信息，现在需要搜索购物地点来满足用户的购物需求，并估算相关费用。
**Agent Action**: search_nearby: 银座, 购物, 2000
**PAUSE**

**Observation**: [返回购物地点信息]

**Agent Thought**: 现在有了完整的POI信息，需要计算主要活动地点间的交通时间，优化行程安排。
**Agent Action**: calculate_distance: 银座, 秋叶原, 地铁
**PAUSE**

**Observation**: [返回距离信息：8km, 25分钟, 350日元]

**Agent Answer**: 基于您提供的信息，我为您制定了详细的东京5日游计划！[...完整详细计划...] 这个计划您觉得怎么样？需要调整任何部分吗？