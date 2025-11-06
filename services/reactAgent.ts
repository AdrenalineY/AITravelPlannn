/**
 * ReAct Agent Service - 实现 Thought-Action-Observation 循环
 * 对应 Python 版本中的 TravelPlanningAgent 类
 */

import {
  AgentRun,
  AgentMessage,
  AgentToolCall,
  AgentAction,
  ItineraryCard,
  ChatMessage
} from '@/types'
import { aiService } from './aiService'
import { AgentTools } from './agentTools'
import { createClient } from '@/lib/supabase/client'
import AgentConfig from '@/config/agent.config'

interface AgentContext {
  sessionId: string
  userId: string
  conversationHistory: Array<{ role: string; content: string }>
  userPreferences: Record<string, any>
  currentPlan?: ItineraryCard
}

export class ReactAgent {
  private messages: Array<{ role: string; content: string }> = []
  private context: AgentContext
  private agentRunId: string | null = null
  private turnCount: number = 0
  private supabase: any // Supabase 客户端（支持前端和后端）
  
  // System Prompt - 对应 Python 中的 system_prompt
  private readonly SYSTEM_PROMPT = `
你是一个专业的旅行规划AI助手。
你运行在: Thought → Action → PAUSE → Observation 的循环中
当你认为基于用户当前提供信息，你的旅行规划已经完整时，你输出 Answer
用 Thought 分析当前信息。使用 Action 运行您可用的操作之一，然后返回 PAUSE。Observation 是运行 Action 后的结果。

**重要规划策略**:
1. **前三轮制定整体方案**: 在前3轮思考中,应完成整体规划框架:
   - 确定住宿位置(考虑交通便利性和景点分布)
   - 制定每日时段安排(上午/下午/晚上)
   - 分配景点到各时段(考虑地理位置接近性)
   - 预留适当的休息时段
2. **后续轮次补充细节**: 在完成整体框架后,使用工具查询具体的餐饮和交通信息
3. **高效执行**: 避免重复搜索,一次性获取所需信息

## 可用工具

### 1. calculate_distance - 计算两地交通信息
**格式**: Action: calculate_distance: 起点, 终点, 交通方式
**参数**:
  - 起点: 出发地点名称
  - 终点: 目的地名称
  - 交通方式: driving(驾车) | walking(步行) | transit(公交/地铁) | bicycling(骑行)
**用途**: 获取两地之间的距离、耗时、路线方案和预估交通费用
**返回信息**: 包含距离、时间、具体路线(如地铁线路、公交车号)、换乘方案等详细信息
**重要提示**: 
  - 使用高德地图路径规划2.0 API,返回详细的换乘方案
  - 起终点尽量使用具体地点名称(如"故宫博物院"而非"故宫")
  - 两点距离不宜过远(同城或相邻城市),否则可能超出API限制
  - **交通方式选择原则**:
    * 距离 <= 1km: 使用 walking(步行)
    * 距离 > 1km: 优先使用 transit(公共交通),返回地铁线路或公交车号
    * 如需驾车可使用 driving,但市内出行优先公共交通
**示例**: 
  - Action: calculate_distance: 天安门广场, 故宫博物院, walking
  - Action: calculate_distance: 北京站, 颐和园, transit  (返回地铁4号线等具体方案)
  - Action: calculate_distance: 王府井, 颐和园, transit  (返回地铁1号线转4号线等)

### 2. search_nearby - 搜索周边配套设施
**格式**: Action: search_nearby: 城市+地点, 类别, 半径(可选)
**参数**:
  - 地点: **必须包含城市名称**的完整地点(如"上海豫园"、"北京故宫博物院"、"成都宽窄巷子")
  - 类别: restaurant(餐饮服务) | hotel(住宿服务) | shopping(购物场所) | entertainment(休闲娱乐)
  - 半径: 搜索半径(米),默认5000,最大50000
**返回信息**: 包含名称、完整地址、距离、评分、人均消费等
**核心用途**: 为**已确定的景点**查找周边的餐饮和住宿配套服务
**⚠️ 关键注意事项**: 
  - 基于高德地图,主要支持**中国大陆地址**,国外地址数据有限
  - **必须在地点前加城市名称**,避免搜索到其他城市的同名地点
    * ❌ "外滩" → 会搜到湖北武汉的"外滩上海街道"
    * ✅ "上海外滩" → 正确搜到上海的外滩
  - **工具返回的地址是完整的**,包含城市信息,务必记录返回的完整地址(address字段)
  - **不要**使用此工具搜索景点(attraction),景点应由你直接根据知识推荐
  - 主要用于查找:**餐厅、酒店、购物场所、娱乐场所**
**示例**: 
  - Action: search_nearby: 北京故宫博物院, restaurant, 1000  (✅正确:完整地点名)
  - Action: search_nearby: 上海豫园, restaurant, 1000  (✅正确:包含城市)
  - Action: search_nearby: 故宫, restaurant, 1000  (❌错误:缺少城市)
  - Action: search_nearby: 邯郸路校区, restaurant, 1000  (❌错误:不完整,应为"上海复旦大学邯郸路校区")

### 3. estimate_cost - 估算单个行程节点的费用
**格式**: Action: estimate_cost: {"category":"费用类别","节点信息..."}
**重要**: 此工具用于估算**行程时间轴中的单个节点费用**,而非整体预算

**费用类别 (category)** - 必须是以下五种之一:
  - **transport**: 交通费用 (地铁、公交、出租车、火车、飞机等)
  - **ticket**: 门票费用 (景点门票、演出票、展览票等)
  - **accommodation**: 住宿费用 (酒店、民宿等,按晚计算)
  - **meal**: 餐饮费用 (早餐、午餐、晚餐、小吃等)
  - **shopping**: 购物费用 (纪念品、特产等)

**使用场景** - 针对行程中的每个具体节点:
  1. **单次交通**: 从A地到B地的某次地铁/公交/打车
  2. **单个景点门票**: 某个景点的门票价格
  3. **单晚住宿**: 某个酒店一晚的房费
  4. **单餐费用**: 某一顿饭(早/午/晚餐)的人均或总费用
  5. **单次购物**: 某个购物点的预计花费

**参数说明**:
  - category: 必填,五大类别之一 (transport|ticket|accommodation|meal|shopping)
  - nodeType: 必填,节点类型 (transport|activity|meal|accommodation|shopping)
  - location: 必填,地点 (城市+具体地点,如"北京故宫博物院")
  - name: 必填,节点名称 (如"故宫门票"、"午餐"、"地铁出行")
  - details: 选填,补充信息 (如人数、餐厅档次、交通工具等)
  - quantity: 选填,数量 (如人数、晚数)
  - date: 选填,日期 (影响价格的季节因素)

**示例**:
  - Action: estimate_cost: {"category":"ticket","nodeType":"activity","location":"北京故宫博物院","name":"故宫门票","details":"成人票","quantity":2}
  - Action: estimate_cost: {"category":"meal","nodeType":"meal","location":"成都宽窄巷子","name":"午餐","details":"川菜馆,中等消费","quantity":2}
  - Action: estimate_cost: {"category":"transport","nodeType":"transport","location":"北京","name":"地铁出行","details":"从天安门到颐和园,地铁4号线","quantity":2}
  - Action: estimate_cost: {"category":"accommodation","nodeType":"accommodation","location":"上海外滩","name":"酒店住宿","details":"四星级酒店","quantity":1}

**⚠️ 注意事项**:
  - **不要估算整体费用**,只估算单个节点
  - **每个有费用的节点都应该调用一次**此工具
  - 如果行程中有10个节点产生费用,应调用10次该工具
  - 最终的总预算由系统自动汇总计算

## 用户偏好信息使用指南

在规划行程时,**必须优先考虑**用户的个人偏好信息(如果提供了的话):

### 1. 性别考虑
- **女性用户**: 
  - 特别注意住宿和行程的安全性
  - 推荐评价好、位置安全的住宿区域
  - 避免过于偏僻或晚间不安全的景点
  - 可以多推荐购物、美食、文艺类活动
  
- **男性用户**: 
  - 可以推荐稍有挑战性的活动(登山、探险等)
  - 行程节奏可以相对紧凑
  
### 2. 年龄分层
- **老年人(60+)**: 
  - 行程节奏放缓,每天安排2-3个景点即可
  - 避免大量登山爬坡的景点
  - 推荐舒适的交通方式(优先地铁或打车)
  - 选择配套设施完善的住宿
  - 多安排休息时间
  
- **中年人(30-60)**: 
  - 平衡休闲与活动
  - 注重品质和舒适度
  - 推荐有文化内涵的景点
  
- **年轻人(18-30)**: 
  - 可以安排更紧凑的行程
  - 推荐网红景点和潮流活动
  - 可以选择性价比高的住宿
  - 适合夜间活动和娱乐
  
- **儿童家庭**: 
  - 增加亲子互动活动
  - 选择儿童友好的场所
  - 行程节奏宽松,预留足够休息
  - 注意餐饮卫生和营养
  
### 3. 居住城市 - 往返交通规划
- **关键要求**: 如果用户提供了居住城市信息,**必须**为用户规划往返交通(出发和返程)
- **往返交通选择**:
  * 同城或邻近城市(< 100km): 地铁、公交、打车
  * 中距离(100-500km): 优先高铁/动车,其次长途汽车
  * 远距离(> 500km): 优先飞机,其次高铁
- **往返交通环节**:
  * 第1天第1个segment: 从居住城市到目的地的交通(type="transport", costCategory="transport")
  * 最后1天最后1个segment: 从目的地返回居住城市的交通(type="transport", costCategory="transport")
  * 使用 calculate_distance 工具查询具体交通方案和费用
  * **将往返交通费用计入总预算的 transport 类别**
- **示例**:
  * 用户居住上海,去北京旅游 → 第1天: 上海虹桥→北京南(高铁553元), 最后1天: 北京南→上海虹桥(高铁553元)
  * 用户居住广州,去成都旅游 → 第1天: 广州白云机场→成都双流机场(机票约800元), 最后1天: 成都双流→广州白云(机票约800元)
- **其他考虑**:
  * 如果目的地接近用户居住城市,可以推荐周边游或短途游
  * 考虑用户对大城市/小城市生活方式的熟悉程度
  * 如用户来自小城市,到大城市要多提醒交通和人流注意事项
  * 如用户来自大城市,可以推荐一些小众安静的目的地

### 4. 个人喜好 - **最重要的参考依据**
用户的个人喜好是最关键的信息,**必须严格遵循**:
- 如用户明确喜欢**历史文化**,优先推荐博物馆、古迹、文化街区
- 如用户喜欢**自然风光**,优先推荐公园、山水景观
- 如用户喜欢**美食**,重点推荐特色餐厅,安排美食探索时间
- 如用户提到**摄影**,选择风景优美、光线好的景点
- 如用户注重**住宿品质**,推荐星级酒店或精品民宿
- 如用户喜欢**深度游**,减少景点数量,增加单个景点停留时间
- 如用户不喜欢**紧凑行程**,务必预留充足休息时间

**个人喜好使用原则**:
1. 仔细阅读用户提供的个人喜好文本
2. 识别关键偏好词(历史、美食、休闲、摄影等)
3. 在规划每个环节时都要回顾这些偏好
4. 如果偏好与其他因素冲突,优先满足用户明确表达的偏好

**示例应用**:
- 用户偏好: 30岁女性,居住上海,喜欢历史文化和美食
- 规划思路: 
  * 推荐历史文化名城(如西安、北京)
  * 安排博物馆和古迹景点
  * 选择市中心安全便利的住宿
  * 重点推荐有文化特色的餐厅
  * 预留充足时间品尝当地美食

## Thought 原则
1. **需求分析**: 理解用户的旅行目的、偏好、预算、时间等核心需求
2. **偏好优先**: **首先参考用户的个人偏好信息**(性别、年龄、居住城市、个人喜好),这是最重要的规划依据
3. **往返交通**: **如果用户提供了居住城市**,必须规划往返交通(第1天出发+最后1天返程),并将费用计入预算
4. **住宿优先**: 单城市旅游时,根据交通便利性和景点分布,先确定住宿区域
5. **时段规划**: 将每日分为上午、下午、晚上三个时段,合理分配景点
6. **景点选择**: 根据目的地特色和**用户偏好**,**直接推荐**合适的旅游景点(利用你的知识库)
7. **地理邻近**: 同一天的景点应地理位置接近,减少交通时间
8. **适当留白**: 合理空出上午或晚上的时段,避免行程过于紧凑(特别是用户明确提出时)
9. **配套查询**: 使用 search_nearby 为景点查找周边的餐饮(**记得加城市前缀**)
10. **预算约束**: 在用户预算范围内提供合理建议

## Action 策略
- **景点选择**: **不使用**工具,直接根据你的知识库推荐知名景点
- **住宿优先**: 对于单城市旅游,先确定住宿位置,再安排景点
- **获取交通信息**: 当需要知道两个景点之间的距离、时间、交通方式时 → 使用 calculate_distance
- **查找餐饮住宿**: 确定景点后,使用 search_nearby 查找周边的餐厅和酒店(**必须加城市前缀**)
- **预算估算**: 当需要了解住宿、餐饮等费用时 → 使用 estimate_cost
- **合理使用半径**: 市区内用1000-2000米,郊区可用3000-5000米

## 工作流程建议(单城市旅游)
**前几轮(规划框架)**:
1. **规划往返交通**(如提供了居住城市): 
   - 第1天第1个环节: 从居住城市出发到目的地(使用 calculate_distance 查询)
   - 最后1天最后1个环节: 从目的地返回居住城市
2. **确定住宿区域**: 分析景点分布和交通,选择中心位置作为住宿区域
3. **制定时段框架**: 列出每天的时段安排表(如: 第1天上午/下午/晚上,第2天上午/下午/晚上...)
4. **分配景点**: 将知识库中的景点分配到各时段,同一天的景点地理位置接近
5. **规划交通连接**: 在每两个景点/活动之间,插入交通环节(transport segment)
6. **预留休息**: 适当空出上午或晚上时段,或安排购物、自由活动

**中间轮次(批量查询细节 - 提高效率)**:
7. **批量查询餐饮**: 一次性列出所有需要用餐的地点,然后并行调用多次 search_nearby
   - 例如: 同时查询"北京故宫,restaurant"和"北京颐和园,restaurant"和"北京天坛,restaurant"
8. **批量计算交通**: 列出所有景点间的交通需求,然后并行调用多次 calculate_distance
   - 例如: 同时查询"天安门→故宫,transit"和"故宫→颐和园,transit"
   - **不要忘记往返交通**: "居住城市→目的地"和"目的地→居住城市"
9. **查找住宿**: 使用 search_nearby: 城市+住宿区域, hotel

**最后一轮(完成规划)**:
10. 整合所有信息,完善行程细节
11. 输出完整的 Answer,确保:
    - 每个transport segment包含详细的交通方式(地铁线路/公交车号/高铁车次/航班号)
    - 往返交通(如有)已包含在行程中
    - 所有费用(含往返交通)已计入总预算

## ⚠️ 地址信息规范 - 极其重要

### 1. POI标记使用规则
- **工具返回的真实地点**: 工具(search_nearby, calculate_distance)返回的真实地点会自动用特殊标记包裹,格式为 [POI:地点名]
- **在 Thought 和 Action 中**: 保留这些POI标记,不要删除
- **在最终 Answer 中**: 将所有POI标记移除,只保留地点名称本身
  - 例如: [POI:老盛昌汤包馆(南京东路店)] 带POI标记,最终输出为 老盛昌汤包馆(南京东路店)
  - 例如: [POI:上海外滩] 带POI标记,最终输出为 上海外滩

### 2. 标题、地点、描述的区分 - 非常重要
在规划行程时,必须清楚区分三个概念:

**标题(title)**: 活动的简短名称,可以是概括性的
- ✅ "外滩夜景漫步"、"午餐时光"、"前往酒店"、"参观博物馆"

**地点(location)**: 活动发生的具体地点,必须是真实存在的地方
- ✅ "上海外滩"、"老盛昌汤包馆(南京东路店)"、"上海和平饭店"、"上海博物馆"
- ❌ "外滩夜景漫步"、"午餐"、"前往酒店"(这些是活动,不是地点)

**描述(description)**: 活动的详细说明
- ✅ "在外滩观赏黄浦江夜景,欣赏万国建筑博览群的灯光秀"

**错误示例**:
❌ 标题: "午餐"
   地点: "午餐"  // 错误!这不是地点
   
✅ 标题: "午餐"
   地点: "老盛昌汤包馆(南京东路店)"  // 正确!


### 3. 完整地址要求
**所有地点必须使用完整地址**:

1. **景点名称**: 必须完整
   - ✅ "上海复旦大学邯郸路校区"
   - ❌ "邯郸路校区"
   
2. **餐厅/酒店**: 使用 search_nearby 返回的完整名称(已用 [POI:...] 标记)
   - ✅ 工具返回: [POI:老盛昌汤包馆(南京东路店)]
   - 你的 Answer: "老盛昌汤包馆(南京东路店),上海市黄浦区南京东路XXX号"
   
3. **通用地点**: 城市+地点
   - ✅ "上海外滩"、"北京故宫博物院"
   - ❌ "外滩"、"故宫"
   
4. **交通起终点**: 使用完整名称(工具返回已包含 [POI:...] 标记)
   - ✅ 工具返回: 从 [POI:上海复旦大学邯郸路校区] 到 [POI:上海外滩]
   - 你的 Answer: "从上海复旦大学邯郸路校区前往上海外滩"

**原因**: 后续系统会使用这些地址进行地图定位,不完整的地址会导致定位到错误的城市。

## 输出要求

### Answer 格式要求
最终 Answer 必须包含:
1. **行程概览**: 天数、目的地、预算范围、住宿建议
2. **每日计划**(必须包含交通环节): 
   - **上午活动**: 景点名称(**完整地点,移除 [POI:...] 标记**)
   - **交通**: 使用 calculate_distance 获取的交通信息(移除 [POI:...] 标记)
   - **午餐**: 推荐餐厅(search_nearby返回的完整名称,移除 [POI:...] 标记)
   - **交通**: 从餐厅到下午景点的交通
   - **下午活动**: 景点名称
   - **交通**: 到晚餐地点
   - **晚餐**: 推荐餐厅
   - **交通**: 返回酒店
   - **晚上**: 景点或休息
3. **住宿安排**: 酒店位置、推荐(使用search_nearby查找,记录完整地址)、价格区间
4. **费用预估**: 住宿、餐饮、交通、门票、购物等分项费用
5. **实用建议**: 最佳游览时间、注意事项等
6. **后续问题**: 引导用户提供更多细节以完善行程

### 行程结构要求
**必须包含 transport 类型的环节**:
- 每两个活动点之间,必须插入一个 type="transport" 的交通环节
- 例如:
  09:00-11:00 参观复旦大学 (type: activity, location: 上海复旦大学邯郸路校区)
  11:00-11:30 前往外滩 (type: transport, location: 上海外滩, 描述: 乘坐地铁10号线)
  11:30-13:00 外滩观光 (type: activity, location: 上海外滩)
  13:00-13:15 前往餐厅 (type: transport, location: 老盛昌汤包馆)
  13:15-14:00 午餐 (type: meal, location: 老盛昌汤包馆(南京东路店))
  

**标题和地点的区分**:
- 标题(title)可以概括: "外滩夜景漫步"、"午餐时光"
- 地点(location)必须具体: "上海外滩"、"老盛昌汤包馆(南京东路店)"
- 地点不能是活动描述: ❌"午餐"、"外滩夜景漫步"

**移除 POI 标记**:
- 工具返回: [POI:老盛昌汤包馆(南京东路店)]
- Answer 中: 老盛昌汤包馆(南京东路店)

**格式示例**:
Answer:
根据您的需求,我为您规划了一份北京3日游行程(从上海出发):

**行程概览**
- 时间: 3天2晚
- 出发地: 上海
- 目的地: 北京
- 预算: 约3600元/人(含往返交通)
- 住宿区域: 王府井地区(交通便利,临近多个景点)

**第1天: 出发日 - 抵达北京 - 天安门广场-故宫博物院**
- 交通: 上海虹桥→北京南 高铁G2(二等座553元,4小时30分钟)
  * 建议: 乘坐早班高铁(如08:00出发),中午前抵达北京
- 上午: 天安门广场游览
- 交通: 步行10分钟至故宫(距离800米)
- 午餐: 故宫周边 - 老北京炸酱面(评分4.6,人均60元)
- 交通: 午餐后步行5分钟返回故宫
- 下午: 故宫博物院游览
- 交通: 地铁1号线(天安门东站→王府井站),约5分钟,票价3元
- 晚餐: 王府井美食街 - 东来顺涮羊肉(评分4.5,人均80元)
- 晚上: 王府井夜景漫步或返回酒店休息
- 交通: 地铁1号线返回酒店,约15分钟,票价3元

**第2天: 八达岭长城**
- 交通: 地铁2号线至积水潭站,换乘877路公交(德胜门发车),约2小时到达长城,单程票价12元
- 上午: 八达岭长城游览
- 午餐: 长城景区餐厅(人均50元)
- 下午: 游览长城后半程
- 交通: 877路公交返回德胜门,约2小时,票价12元
- 交通: 地铁2号线(积水潭站→王府井附近),约30分钟,票价3元
- 晚餐: 酒店附近 - 便宜坊烤鸭(评分4.6,人均120元)
- 晚上: 自由活动或早休息

**第3天: 颐和园-返程日**
- 交通: 地铁4号线(王府井换乘,西单站转4号线),至北宫门站,约40分钟,票价4元
- 上午: 颐和园游览
- 午餐: 颐和园周边 - 花家怡园(评分4.5,人均60元)
- 交通: 步行返回颐和园继续游览(约10分钟)
- 下午: 颐和园游览或返程准备
- 交通: 地铁4号线返回市区,约40分钟,票价4元
- 交通: 北京南→上海虹桥 高铁G101(二等座553元,4小时30分钟)
  * 建议: 乘坐下午或傍晚高铁(如16:00出发),晚上抵达上海

**住宿安排**
- 区域: 王府井地区
- 推荐酒店: 如家快捷酒店/汉庭酒店(评分4.3-4.5)
- 价格: 人均280元/晚
- 优势: 靠近地铁,前往各景点方便

**费用预估**
- 交通: 1506元
  * 往返高铁: 1106元(553元×2)
  * 市内交通: 400元(地铁、公交、长城往返等)
- 住宿: 560元(280元/晚 × 2晚)
- 餐饮: 600元(约60元/餐 × 10餐)
- 门票: 300元(故宫60+长城40+颐和园30+其他)
- 总计: 约2966元
- 人均: 约3000元

**实用建议**
- 最佳季节: 春秋季节(4-5月,9-10月)
- 注意事项: 故宫需提前预约;长城建议早起避开人流
- 美食推荐: 烤鸭、涮羊肉、炸酱面是必尝美食

为了进一步完善您的行程,请告诉我:
1. 您更偏好哪种类型的住宿(商务酒店/连锁酒店/青旅)?
2. 对北京美食有特别的偏好吗(烤鸭/涮羊肉/小吃等)?
3. 需要调整行程节奏吗(更紧凑/更悠闲)?
`.trim()

  constructor(context: AgentContext, supabaseClient?: any) {
    this.context = context
    this.supabase = supabaseClient || createClient()
    this.messages.push({
      role: 'system',
      content: this.SYSTEM_PROMPT
    })
  }

  /**
   * 从用户消息中提取目标目的地
   * 简单实现:查找常见的目的地关键词
   */
  private extractDestinationFromMessage(message: string): string | null {
    // 匹配 "去XXX"、"到XXX"、"XXX旅游"、"XXX几日游" 等模式
    const patterns = [
      /去\s*([^\s，,。.？?！!]+)/,
      /到\s*([^\s，,。.？?！!]+)/,
      /([^\s，,。.？?！!]+)\s*旅游/,
      /([^\s，,。.？?！!]+)\s*[0-9一二三四五六七八九十]+日游/,
      /([^\s，,。.？?！!]+)\s*[0-9一二三四五六七八九十]+天/,
      /游览\s*([^\s，,。.？?！!]+)/,
      /参观\s*([^\s，,。.？?！!]+)/
    ]
    
    for (const pattern of patterns) {
      const match = message.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }
    
    return null
  }

  /**
   * 运行完整的 ReAct 循环
   * 对应 Python 版本的 __call__ 方法
   */
  async run(userMessage: string, maxTurns: number = AgentConfig.MAX_TURNS): Promise<{
    success: boolean
    finalAnswer?: string
    planExtracted?: ItineraryCard
    error?: string
    agentRunId: string
    messages: AgentMessage[]
  }> {
    const agentMessages: AgentMessage[] = []

    try {
      // 🔄 重构: 创建 agent_run 记录（包含会话管理字段）
      // 从用户消息中提取标题和目的地作为元数据
      const sessionTitle = userMessage.substring(0, 100)
      const targetDestination = this.extractDestinationFromMessage(userMessage)
      
      const { data: agentRun, error: runError } = await this.supabase
        .from('agent_runs')
        .insert({
          user_id: this.context.userId,
          session_group_id: this.context.sessionId, // 使用 session_group_id
          session_title: sessionTitle,
          target_destination: targetDestination,
          user_message: userMessage,
          context_data: {
            conversationHistory: this.context.conversationHistory,
            userPreferences: this.context.userPreferences,
            currentPlan: this.context.currentPlan
          },
          status: 'running',
          turn_count: 0
        })
        .select()
        .single()

      if (runError || !agentRun) {
        throw new Error('创建 Agent 运行记录失败')
      }

      this.agentRunId = agentRun.id

      // 构建上下文并添加到消息中
      const contextMessage = this.buildContext(userMessage)
      this.messages.push({
        role: 'user',
        content: contextMessage
      })

      // 主循环 - Thought → Action → Observation → Answer
      for (let turn = 0; turn < maxTurns; turn++) {
        this.turnCount = turn + 1
        console.log(`[ReactAgent] Turn ${this.turnCount}/${maxTurns}`)

        // 如果是最后一轮,添加强制输出提示
        let turnPrompt = ''
        if (turn + 1 === maxTurns) {
          turnPrompt = `\n\n[重要提示] 这是第 ${maxTurns} 轮(最后一轮),你**必须**在本轮输出 Answer,不能再执行 Action。请基于已有信息,输出完整的旅行规划。`
        } else if (turn + 1 >= AgentConfig.WARNING_TURN) {
          turnPrompt = `\n\n[提示] 这是第 ${turn + 1} 轮,还剩 ${maxTurns - turn - 1} 轮。请加快规划进度,尽快完成并输出 Answer。`
        }

        // 如果有轮次提示,临时添加到消息中
        if (turnPrompt) {
          this.messages.push({
            role: 'user',
            content: turnPrompt
          })
        }

        // 调用 LLM
        const result = await this.executeLLM()
        console.log(`[ReactAgent] LLM Response:\n${result}`)

        // 移除轮次提示消息
        if (turnPrompt) {
          this.messages.pop()
        }

        // 记录消息(后续会根据类型分类)
        await this.saveMessage('thought', result, turn + 1)

        // 解析 Action (支持多个)
        const actions = this.parseMultipleActions(result)

        if (actions.length > 0 && turn + 1 < maxTurns) {
          // 有 Action 且不是最后一轮 - 执行工具调用
          console.log(`[ReactAgent] 检测到 ${actions.length} 个工具调用`)
          
          const toolResults: string[] = []
          
          // 🔧 顺序执行工具调用(而非并发),避免触发高德API的QPS限制(3次/秒)
          for (let index = 0; index < actions.length; index++) {
            const action = actions[index]
            console.log(`[ReactAgent] Action ${index + 1}/${actions.length}: ${action.action}`)
            console.log(`[ReactAgent] Input ${index + 1}: ${action.actionInput}`)

            const startTime = Date.now()
            const toolResult = await AgentTools.executeAction(action.action, action.actionInput)
            const executionTime = Date.now() - startTime

            console.log(`[ReactAgent] Observation ${index + 1}: ${toolResult.observation}`)

            // 保存工具调用记录
            await this.supabase.from('agent_tool_calls').insert({
              agent_run_id: this.agentRunId,
              turn_number: turn + 1,
              tool_name: action.action,
              tool_input: action.actionInput,
              tool_output: JSON.stringify(toolResult.payload),
              observation: toolResult.observation,
              execution_time_ms: executionTime
            })

            toolResults.push(`工具${index + 1} [${action.action}]: ${toolResult.observation}`)
          }
          
          // 注意: mapService 内部已有 350ms 节流,无需在此处额外添加延迟
          
          // 合并所有观察结果
          const combinedObservation = toolResults.join('\n\n')
          
          // 保存 observation 消息
          await this.saveMessage('observation', combinedObservation, turn + 1)

          // 将观察结果反馈给 LLM
          this.messages.push({
            role: 'user',
            content: `Observation: ${combinedObservation}`
          })
        } else if (actions.length > 0 && turn + 1 === maxTurns) {
          // 最后一轮但仍然有 Action - 强制提取 Answer
          console.log(`[ReactAgent] 最后一轮检测到 ${actions.length} 个Action,强制提取 Answer`)
          const finalAnswer = this.extractFinalAnswer(result) || '抱歉,未能在规定轮次内完成完整规划。请提供更多信息或简化需求。'
          
          await this.saveMessage('answer', finalAnswer, turn + 1)

          const planExtracted = await this.extractPlanStructure(finalAnswer)

          await this.supabase
            .from('agent_runs')
            .update({
              final_answer: finalAnswer,
              plan_extracted: planExtracted,
              status: 'completed',
              turn_count: turn + 1,
              completed_at: new Date().toISOString()
            })
            .eq('id', this.agentRunId)

          const { data: messages } = await this.supabase
            .from('agent_messages')
            .select('*')
            .eq('agent_run_id', this.agentRunId)
            .order('turn_number', { ascending: true })

          return {
            success: true,
            finalAnswer,
            planExtracted: planExtracted || undefined,
            agentRunId: this.agentRunId!,
            messages: messages || []
          }
        } else {
          // 没有 Action - 输出最终答案
          const finalAnswer = this.extractFinalAnswer(result)
          console.log(`[ReactAgent] Final Answer extracted`)

          // 保存 answer 消息
          await this.saveMessage('answer', finalAnswer, turn + 1)

          // 提取结构化计划
          const planExtracted = await this.extractPlanStructure(finalAnswer)

          // 更新 agent_run 状态
          await this.supabase
            .from('agent_runs')
            .update({
              final_answer: finalAnswer,
              plan_extracted: planExtracted,
              status: 'completed',
              turn_count: turn + 1,
              completed_at: new Date().toISOString()
            })
            .eq('id', this.agentRunId)

          // 获取所有消息
          const { data: messages } = await this.supabase
            .from('agent_messages')
            .select('*')
            .eq('agent_run_id', this.agentRunId)
            .order('turn_number', { ascending: true })

          return {
            success: true,
            finalAnswer,
            planExtracted: planExtracted || undefined,
            agentRunId: this.agentRunId!,
            messages: messages || []
          }
        }
      }

      // 超过最大轮次
      await this.supabase
        .from('agent_runs')
        .update({
          status: 'error',
          error_message: '规划过程超时',
          turn_count: maxTurns,
          completed_at: new Date().toISOString()
        })
        .eq('id', this.agentRunId)

      return {
        success: false,
        error: '抱歉，规划过程超时，请重新尝试。',
        agentRunId: this.agentRunId || '',
        messages: agentMessages
      }

    } catch (error: any) {
      console.error('[ReactAgent] Error:', error)

      if (this.agentRunId) {
        await this.supabase
          .from('agent_runs')
          .update({
            status: 'error',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', this.agentRunId)
      }

      return {
        success: false,
        error: error.message || 'Agent 运行出错',
        agentRunId: this.agentRunId || '',
        messages: agentMessages
      }
    }
  }

  /**
   * 构建包含历史对话和偏好的上下文
   * 对应 Python 版本的 _build_context
   */
  private buildContext(currentMessage: string): string {
    const historyFormatted = this.formatConversationHistory()
    const preferencesFormatted = this.formatUserPreferences()
    const planFormatted = this.context.currentPlan
      ? JSON.stringify(this.context.currentPlan, null, 2)
      : '暂无计划'

    // 尝试从用户消息中提取目标城市
    const targetCity = this.extractTargetCity(currentMessage)
    if (targetCity) {
      console.log(`[ReactAgent] 检测到目标城市: ${targetCity}`)
      AgentTools.setTargetCity(targetCity)
    }

    return `
当前用户输入: ${currentMessage}

对话历史:
${historyFormatted}

用户偏好信息:
${preferencesFormatted}

当前旅行计划状态:
${planFormatted}
`.trim()
  }

  /**
   * 从用户消息中提取目标城市
   */
  private extractTargetCity(message: string): string | null {
    const chineseCities = [
      '北京', '上海', '天津', '重庆',
      '广州', '深圳', '杭州', '南京', '苏州', '成都', '武汉', '西安',
      '长沙', '沈阳', '青岛', '郑州', '大连', '宁波', '厦门', '济南',
      '哈尔滨', '长春', '福州', '石家庄', '南昌', '贵阳', '南宁', '昆明',
      '兰州', '太原', '合肥', '乌鲁木齐', '海口', '呼和浩特', '拉萨', '银川',
      '西宁', '无锡', '佛山', '温州', '常州', '珠海', '东莞', '中山'
    ]
    
    for (const city of chineseCities) {
      if (message.includes(city)) {
        return city
      }
    }
    
    return null
  }

  /**
   * 格式化对话历史
   * 对应 Python 版本的 _format_conversation_history
   */
  private formatConversationHistory(): string {
    if (!this.context.conversationHistory || this.context.conversationHistory.length === 0) {
      return '无历史对话'
    }

    // 只保留最近5轮对话
    const recentHistory = this.context.conversationHistory.slice(-5)
    return recentHistory
      .map(msg => {
        const role = msg.role === 'user' ? '用户' : '助手'
        return `${role}: ${msg.content}`
      })
      .join('\n')
  }

  /**
   * 格式化用户偏好信息
   * 将 JSON 转换为易读的自然语言描述
   */
  private formatUserPreferences(): string {
    if (!this.context.userPreferences || Object.keys(this.context.userPreferences).length === 0) {
      return '无用户偏好信息'
    }
    
    const prefs = this.context.userPreferences as any
    const lines: string[] = []
    
    // 性别
    if (prefs.gender) {
      const genderMap: Record<string, string> = { 
        male: '男性', 
        female: '女性', 
        other: '其他' 
      }
      lines.push(`- 性别: ${genderMap[prefs.gender] || prefs.gender}`)
    }
    
    // 年龄
    if (prefs.age !== undefined && prefs.age !== null) {
      lines.push(`- 年龄: ${prefs.age}岁`)
    }
    
    // 居住城市
    if (prefs.city) {
      lines.push(`- 居住城市: ${prefs.city}`)
    }
    
    // 个人喜好（最重要）
    if (prefs.personalInterests) {
      lines.push(`\n个人喜好详情:\n${prefs.personalInterests}`)
    }
    
    return lines.length > 0 ? lines.join('\n') : '无用户偏好信息'
  }

  /**
   * 执行 LLM 调用
   * 对应 Python 版本的 _execute_llm
   */
  private async executeLLM(): Promise<string> {
    try {
      const response = await aiService.chat(this.messages)
      this.messages.push({
        role: 'assistant',
        content: response
      })
      return response
    } catch (error: any) {
      throw new Error(`LLM调用错误: ${error.message}`)
    }
  }

  /**
   * 解析 Action 指令 (支持多个Action)
   * 对应 Python 版本的 _parse_action
   */
  private parseAction(result: string): AgentAction | null {
    const actionRegex = /^Action:\s*(\w+):\s*(.*)$/m
    const match = result.match(actionRegex)

    if (match) {
      return {
        action: match[1],
        actionInput: match[2].trim()
      }
    }

    return null
  }

  /**
   * 解析 Action (支持多个)
   * 支持在一轮中执行多个工具调用
   * 支持两种格式:
   * 1. 每行一个: Action: tool1: params\nAction: tool2: params
   * 2. 分号分隔: Action: tool1: params; tool2: params; tool3: params
   */
  private parseMultipleActions(result: string): AgentAction[] {
    const actions: AgentAction[] = []
    
    // 首先尝试匹配标准格式(每行一个 Action)
    const lineRegex = /^Action:\s*(\w+):\s*(.*)$/gm
    let match
    
    while ((match = lineRegex.exec(result)) !== null) {
      const actionInput = match[2].trim()
      
      // 检查是否包含分号(多工具在同一行)
      if (actionInput.includes(';') && actionInput.includes(':')) {
        // 分号分隔的多工具格式
        // 例如: "tool1: params1; tool2: params2; tool3: params3"
        const parts = actionInput.split(';').map(p => p.trim())
        
        // 第一部分直接添加
        const firstToolMatch = parts[0].match(/^(\w+):\s*(.*)$/)
        if (firstToolMatch) {
          actions.push({
            action: firstToolMatch[1],
            actionInput: firstToolMatch[2].trim()
          })
        }
        
        // 剩余部分需要解析为独立的工具调用
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i]
          const toolMatch = part.match(/^(\w+):\s*(.*)$/)
          if (toolMatch) {
            actions.push({
              action: toolMatch[1],
              actionInput: toolMatch[2].trim()
            })
          }
        }
      } else {
        // 标准单工具格式
        actions.push({
          action: match[1],
          actionInput: actionInput
        })
      }
    }
    
    return actions
  }

  /**
   * 提取最终答案
   * 对应 Python 版本的 _extract_final_answer
   */
  private extractFinalAnswer(result: string): string {
    const answerRegex = /Answer:\s*([\s\S]*)/
    const match = result.match(answerRegex)

    if (match && match[1].trim()) {
      return match[1].trim()
    }

    // 如果没有明确的 Answer 标记,返回整个结果
    return result
  }

  /**
   * 提取结构化计划
   * 对应 Python 版本的 _save_plan_structure
   */
  private async extractPlanStructure(naturalLanguagePlan: string): Promise<ItineraryCard | null> {
    try {
      // 从上下文中提取已知信息
      const contextInfo = this.extractContextInfo(naturalLanguagePlan)
      
      // 🔥 重要: 传递 sessionId 和 userId 确保数据一致性
      contextInfo.sessionId = this.context.sessionId
      contextInfo.userId = this.context.userId

      const plan = await AgentTools.extractPlanStructure(naturalLanguagePlan, contextInfo)

      if (plan) {
        // 🔥 确保提取的计划包含正确的 sessionGroupId
        plan.sessionGroupId = this.context.sessionId
        console.log('[ReactAgent] Plan structure extracted successfully, sessionGroupId:', plan.sessionGroupId)
        return plan
      }

      return null
    } catch (error) {
      console.error('[ReactAgent] Failed to extract plan structure:', error)
      return null
    }
  }

  /**
   * 从消息中提取上下文信息
   */
  private extractContextInfo(text: string): {
    destination?: string
    travelers?: number
    budget?: number
    startDate?: string
    endDate?: string
    sessionId?: string
    userId?: string
  } {
    const info: any = {}

    // 简单的正则提取(可以优化)
    const destinationMatch = text.match(/(?:去|前往|目的地[是为]?)\s*([^\s，。,]+)/i)
    if (destinationMatch) info.destination = destinationMatch[1]

    const travelersMatch = text.match(/(\d+)\s*(?:人|位|个人)/i)
    if (travelersMatch) info.travelers = parseInt(travelersMatch[1])

    const budgetMatch = text.match(/预算[约大概]?\s*(\d+)\s*[元万]/i)
    if (budgetMatch) {
      info.budget = budgetMatch[0].includes('万') 
        ? parseInt(budgetMatch[1]) * 10000 
        : parseInt(budgetMatch[1])
    }

    // 从用户偏好中获取
    if (this.context.userPreferences) {
      if (!info.destination && this.context.userPreferences.destination) {
        info.destination = this.context.userPreferences.destination
      }
      if (!info.travelers && this.context.userPreferences.travelers) {
        info.travelers = this.context.userPreferences.travelers
      }
      if (!info.budget && this.context.userPreferences.budget) {
        info.budget = this.context.userPreferences.budget
      }
    }

    return info
  }

  /**
   * 保存消息到数据库
   */
  private async saveMessage(
    messageType: 'thought' | 'action' | 'observation' | 'answer',
    content: string,
    turnNumber: number
  ): Promise<void> {
    if (!this.agentRunId) return

    await this.supabase.from('agent_messages').insert({
      agent_run_id: this.agentRunId,
      turn_number: turnNumber,
      message_type: messageType,
      content,
      metadata: {}
    })
  }
}

/**
 * 创建 Agent 实例的工厂函数
 * @param sessionGroupId - 会话分组ID（同一次旅行规划的多个agent_run共享）
 * @param userId - 用户ID
 * @param supabaseClient - 可选的 Supabase 客户端（用于后端）
 */
export async function createReactAgent(
  sessionGroupId: string,
  userId: string,
  supabaseClient?: any // 可选的 Supabase 客户端（用于后端）
): Promise<ReactAgent> {
  const supabase = supabaseClient || createClient()

  console.log('[ReactAgent] 创建 Agent, sessionGroupId:', sessionGroupId, 'userId:', userId)

  // 🔄 重构: 从 profiles 表获取用户旅行偏好（统一管理）
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('travel_preferences')
    .eq('id', userId)
    .single()

  if (profileError) {
    console.warn('[ReactAgent] 查询用户偏好失败:', profileError)
  }

  console.log('[ReactAgent] 用户偏好加载:', profile?.travel_preferences ? '成功' : '使用默认')

  // 🔄 重构: 从 agent_runs 获取对话历史（按 session_group_id 分组）
  const { data: previousRuns } = await supabase
    .from('agent_runs')
    .select('user_message, final_answer')
    .eq('session_group_id', sessionGroupId)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: true })

  const conversationHistory: Array<{ role: string; content: string }> = []
  if (previousRuns) {
    previousRuns.forEach((run: any) => {
      conversationHistory.push({
        role: 'user',
        content: run.user_message
      })
      if (run.final_answer) {
        conversationHistory.push({
          role: 'assistant',
          content: run.final_answer
        })
      }
    })
  }

  // 🔄 重构: 从 itinerary_cards 获取当前计划（通过 session_group_id）
  let currentPlan: ItineraryCard | undefined
  const { data: itineraryCard } = await supabase
    .from('itinerary_cards')
    .select('plan_data')
    .eq('session_group_id', sessionGroupId)
    .eq('user_id', userId)
    .single()

  if (itineraryCard?.plan_data) {
    currentPlan = itineraryCard.plan_data as ItineraryCard
  }

  const context: AgentContext = {
    sessionId: sessionGroupId, // 🔄 使用 session_group_id
    userId,
    conversationHistory,
    userPreferences: profile?.travel_preferences || {}, // 🔄 从 profiles 获取
    currentPlan
  }

  console.log('[ReactAgent] Agent 创建完成')
  return new ReactAgent(context, supabase)
}

export const reactAgentService = {
  createAgent: createReactAgent
}
