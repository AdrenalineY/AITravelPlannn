# Supabase 数据库重构设计文档 (基于代码分析)

## 📋 重构概述

### 重构目标
1. **简化数据结构**: 将复杂的多表关联简化为基于 JSON 存储的精简架构
2. **保持核心功能**: 确保用户对话历史和行程数据完整性
3. **优化查询性能**: 减少 JOIN 操作，提高数据获取效率
4. **便于维护**: 降低数据模型复杂度，减少维护成本

### 基于 ReactAgent 代码分析的关键发现

#### 1. **用户偏好管理现状**
- 当前位置: `conversation_sessions.user_preferences` 
- 问题: 每个会话单独存储，不利于统一管理
- **解决方案**: 迁移到 `profiles.travel_preferences` 统一管理

#### 2. **会话-行程关系**
- 当前关系: `conversation_sessions.itinerary_id` → `itineraries.id`
- 关系类型: **严格 1:1 关系** (一个会话产生一个行程卡片)

#### 3. **Agent 运行数据存储机制**
从 `ReactAgent.run()` 方法分析得出:
```typescript
// 每次用户输入创建一个 agent_run
const agentRun = await supabase.from('agent_runs').insert({
  session_id, user_message, context, status: 'running'
})

// 每轮循环保存不同类型的消息
await this.saveMessage('thought', result, turnNumber)     // LLM 思考过程
await this.saveMessage('observation', observation, turnNumber) // 工具返回结果  
await this.saveMessage('answer', finalAnswer, turnNumber) // 最终答案

// 每次工具调用保存详细信息
await supabase.from('agent_tool_calls').insert({
  agent_run_id, turn_number, tool_name, tool_input, tool_output, observation, execution_time_ms
})
```

#### 4. **对话历史重建机制**
```typescript
// 从 agent_runs 重建对话历史
const conversationHistory = previousRuns.map(run => [
  { role: 'user', content: run.user_message },
  { role: 'assistant', content: run.final_answer }
])
```

---

## 🗃️ 重构后的数据库架构设计

### 用户相关表 (保留+增强)

#### 1. **profiles** - 用户资料表 (增强)
> **核心变更**: 统一管理用户旅行偏好

```sql
CREATE TABLE public.profiles (
  id uuid NOT NULL,                      -- 用户ID (关联 auth.users.id)
  email text NOT NULL UNIQUE,           -- 邮箱
  full_name text,                        -- 全名
  avatar_url text,                       -- 头像URL
  
  -- 🆕 统一的用户旅行偏好管理
  travel_preferences jsonb DEFAULT '{}', -- 用户旅行偏好 (从 conversation_sessions 迁移至此)
  /*
  travel_preferences 结构 (基于 ReactAgent 的 userPreferences):
  {
    "travelStyle": "休闲",              // 旅行风格
    "budgetRange": "中等",              // 预算范围
    "interests": ["美食", "历史"],       // 兴趣爱好
    "accommodationType": "酒店",        // 住宿偏好
    "transportPreference": "公共交通",  // 交通偏好
    "groupType": "家庭出游",           // 出行类型
    "specialNeeds": [],                 // 特殊需求
    "defaultBudget": 5000,              // 默认预算
    "currency": "CNY"                   // 偏好货币
  }
  */
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
```

#### 2. **user_configs** - API配置表 (保持不变)
```sql
-- 保持现有结构，存储用户的 LLM/语音/地图 API 配置
```

---

### 核心业务表 (重构)

#### 3. **agent_runs** - Agent运行记录表 (增强+会话管理)
> **核心理念**: 记录每次用户输入触发的Agent完整运行过程
> **🔥 新增功能**: 承担会话管理功能，移除单独的 conversation_sessions 表

```sql
CREATE TABLE public.agent_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,                 -- 🔄 直接关联用户，不再需要 session_id
  
  -- 🆕 会话管理字段 (从 conversation_sessions 迁移)
  session_group_id uuid,                 -- 会话分组ID (同一次规划的多个agent_run共享)
  session_title text,                    -- 会话标题 (如: "上海3日游规划")
  target_destination text,               -- 目标目的地 (如: "上海")
  
  -- 输入输出
  user_message text NOT NULL,            -- 用户输入消息
  final_answer text,                     -- Agent 最终回答 (完整的自然语言行程)
  
  -- Agent 运行上下文 (基于 ReactAgent.buildContext())
  context_data jsonb DEFAULT '{}',       -- 运行时上下文
  /*
  context_data 结构 (对应 ReactAgent 的 context):
  {
    "conversationHistory": [             // 对话历史
      {"role": "user", "content": "..."},
      {"role": "assistant", "content": "..."}
    ],
    "userPreferences": {...},            // 用户偏好快照 (从 profiles 获取)
    "currentPlan": {...},                // 当前计划 (如果有)
    "extractedInfo": {                   // 从消息中提取的信息
      "destination": "上海",
      "travelers": 2,
      "budget": 5000,
      "startDate": "2025-12-01",
      "endDate": "2025-12-03"
    }
  }
  */
  
  -- 结构化结果
  plan_extracted jsonb,                  -- 提取的结构化行程 (ItineraryCard 格式)
  itinerary_card_id uuid,                -- 关联生成的行程卡片ID
  
  -- 执行信息
  status text DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  error_message text,
  turn_count integer DEFAULT 0,         -- Agent 循环轮数
  execution_time_ms integer,             -- 总执行时间
  
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  
  CONSTRAINT agent_runs_pkey PRIMARY KEY (id),
  CONSTRAINT agent_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
```

#### 4. **agent_messages** - Agent循环消息表 (保留+优化)
> **核心理念**: 存储Agent每轮循环的详细过程 (Thought-Action-Observation)

```sql
CREATE TABLE public.agent_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_run_id uuid NOT NULL,
  
  -- 循环信息
  turn_number integer NOT NULL,         -- 第几轮循环
  message_type text NOT NULL CHECK (message_type IN ('thought', 'action', 'observation', 'answer')),
  content text NOT NULL,                -- 消息内容
  
  -- 元数据
  metadata jsonb DEFAULT '{}',
  /*
  metadata 结构示例:
  {
    "llm_tokens_used": 1500,            // LLM 使用的 token 数
    "tool_calls_count": 2,               // 本轮工具调用次数
    "processing_time_ms": 3000           // 处理耗时
  }
  */
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT agent_messages_pkey PRIMARY KEY (id),
  CONSTRAINT agent_messages_agent_run_fkey FOREIGN KEY (agent_run_id) REFERENCES public.agent_runs(id) ON DELETE CASCADE
);
```

#### 5. **agent_tool_calls** - 工具调用记录表 (保留+优化)  
> **核心理念**: 详细记录每次工具调用的输入输出

```sql
CREATE TABLE public.agent_tool_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_run_id uuid NOT NULL,
  
  -- 工具调用信息
  turn_number integer NOT NULL,         -- 所属轮次
  tool_name text NOT NULL,              -- 工具名称 (calculate_distance/search_nearby/estimate_cost)
  tool_input text NOT NULL,             -- 工具输入参数
  tool_output jsonb,                     -- 工具返回结果 (JSON格式)
  observation text,                      -- 给 LLM 的观察结果
  
  -- 执行信息
  execution_time_ms integer,             -- 工具执行耗时
  error_message text,                    -- 错误信息 (如果失败)
  
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT agent_tool_calls_pkey PRIMARY KEY (id),
  CONSTRAINT agent_tool_calls_agent_run_fkey FOREIGN KEY (agent_run_id) REFERENCES public.agent_runs(id) ON DELETE CASCADE
);
```

#### 6. **itinerary_cards** - 行程卡片表 (新设计)
> **核心理念**: 存储完整的结构化行程数据，与会话分组 1:1 对应

```sql
CREATE TABLE public.itinerary_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_group_id uuid NOT NULL UNIQUE, -- 🔥 关联 agent_runs.session_group_id，确保 1:1 关系
  
  -- 基本信息 (从 plan_data 冗余存储，便于查询和索引)
  title text NOT NULL,
  destination text NOT NULL,
  start_date date,
  end_date date,
  duration_days integer,
  duration_nights integer,
  travelers integer DEFAULT 1,
  
  -- 🔥 核心字段: 完整的结构化行程数据
  plan_data jsonb NOT NULL,              -- 完整的 ItineraryCard JSON
  /*
  plan_data 完整结构 (基于 agentTools.extractPlanStructure 的输出):
  {
    "id": "uuid",
    "sessionId": "session-uuid", 
    "userId": "user-uuid",
    "title": "上海3日亲子游",
    "destination": "上海",
    "cities": ["上海"],
    "startDate": "2025-12-01",
    "endDate": "2025-12-03",
    "durationDays": 3,
    "durationNights": 2,
    "travelers": 2,
    "travelersDetail": {
      "adults": 2,
      "children": 1,
      "ages": [30, 28, 8]
    },
    "preferences": ["美食", "亲子", "休闲"],
    "travelStyle": "休闲游",
    "theme": "亲子游", 
    "totalBudget": 5000,
    "budgetPerPerson": 2500,
    "currency": "CNY",
    "estimatedCost": {
      "total": 4800,
      "perPerson": 2400,
      "breakdown": [
        {"category": "accommodation", "amount": 1200, "percentage": 25},
        {"category": "meal", "amount": 1800, "percentage": 37.5},
        {"category": "transport", "amount": 800, "percentage": 16.7},
        {"category": "ticket", "amount": 1000, "percentage": 20.8}
      ]
    },
    "accommodation": {...},
    "days": [
      {
        "dayNumber": 1,
        "date": "2025-12-01", 
        "title": "外滩-豫园经典一日游",
        "segments": [
          {
            "order": 1,
            "time": "09:00",
            "type": "activity",
            "title": "游览外滩",
            "location": "上海外滩", 
            "description": "漫步外滩，欣赏黄浦江景色",
            "duration": 120,
            "costEstimate": 0,
            "costCategory": "ticket"
          },
          {
            "order": 2,
            "type": "transport",
            "title": "前往豫园", 
            "transportMode": "subway",
            "transportDetails": {
              "from": "上海外滩",
              "to": "豫园",
              "route": "地铁2号线→地铁10号线",
              "duration": "30分钟",
              "cost": 3
            }
          }
          // ... 更多 segments
        ]
      }
      // ... 更多 days
    ],
    "tips": {...},
    "foodRecommendations": [...], 
    "shoppingSpots": [...],
    "transportationSummary": {...},
    "rawPlan": "Agent生成的自然语言描述前500字",
    "fullPlan": "Agent生成的完整自然语言描述",
    "status": "draft",
    "version": 1
  }
  */
  
  -- 自然语言描述
  natural_plan text,                     -- Agent 生成的完整自然语言行程
  
  -- 冗余字段 (便于快速查询)
  total_budget numeric DEFAULT 0,
  budget_per_person numeric DEFAULT 0,
  estimated_cost jsonb DEFAULT '{}',
  currency text DEFAULT 'CNY',
  
  -- 状态管理
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  version integer DEFAULT 1,
  
  -- 元数据
  tags jsonb DEFAULT '[]',
  is_public boolean DEFAULT false,
  share_code text UNIQUE,
  cover_image text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT itinerary_cards_pkey PRIMARY KEY (id),
  CONSTRAINT itinerary_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
  -- 注意: session_group_id 不设置外键约束，因为它对应 agent_runs 的分组概念而非单条记录
);
```

---

## 🔄 表关系和数据流设计

### 数据关系图 (移除 conversation_sessions)
```
users (1)                    
├─→ profiles (1) ← travel_preferences 统一管理
├─→ user_configs (1) ← API配置
└─→ agent_runs (N) ← 每次用户输入，按 session_group_id 分组
    ├─→ agent_messages (N) ← 每轮循环的 thought/action/observation  
    ├─→ agent_tool_calls (N) ← 每次工具调用
    └─→ itinerary_cards (1) ← 通过 session_group_id 关联
```

### 数据流程设计

#### 1. **用户开始新的旅行规划**
```sql
-- 1. 生成会话分组ID
SET @session_group_id = gen_random_uuid();

-- 2. 从 profiles.travel_preferences 加载用户偏好
SELECT travel_preferences FROM profiles WHERE id = user_id;
```

#### 2. **用户发送消息触发 Agent 运行**
```sql
-- 1. 创建 agent_run 记录 (包含会话信息)
INSERT INTO agent_runs (
  user_id, session_group_id, session_title, target_destination,
  user_message, context_data, status
)
VALUES (
  user_id, @session_group_id, '上海3日游规划', '上海',
  user_message, context_json, 'running'
);

-- 2. Agent 循环过程中保存消息
INSERT INTO agent_messages (agent_run_id, turn_number, message_type, content)
VALUES (run_id, 1, 'thought', 'LLM思考内容');

-- 3. 工具调用记录
INSERT INTO agent_tool_calls (agent_run_id, turn_number, tool_name, tool_input, tool_output)
VALUES (run_id, 1, 'calculate_distance', '天安门,故宫,walking', result_json);

-- 4. 完成后更新状态和结果
UPDATE agent_runs SET 
  final_answer = '完整行程规划',
  plan_extracted = itinerary_card_json,
  status = 'completed'
WHERE id = run_id;
```

#### 3. **生成行程卡片**
```sql
-- 基于 agent_runs.plan_extracted 创建行程卡片
INSERT INTO itinerary_cards (
  user_id, session_group_id, title, destination, plan_data, natural_plan
) VALUES (
  user_id, @session_group_id, 
  plan_json->>'title',
  plan_json->>'destination', 
  plan_json,  -- 完整的结构化数据
  final_answer  -- 自然语言描述
);
```

#### 4. **查询会话和对话历史**
```sql
-- 获取用户的所有会话 (从 agent_runs 分组)
SELECT 
  session_group_id,
  session_title,
  target_destination,
  MIN(created_at) as session_start,
  COUNT(*) as total_runs
FROM agent_runs 
WHERE user_id = ? 
GROUP BY session_group_id, session_title, target_destination
ORDER BY session_start DESC;

-- 获取特定会话的对话历史
SELECT 
  user_message,
  final_answer,
  created_at
FROM agent_runs 
WHERE session_group_id = ? AND status = 'completed'
ORDER BY created_at;
```

---

## 🎯 重构要点和Agent代码对齐

### 1. **用户偏好管理对齐**
**现状** (`ReactAgent.createReactAgent`):
```typescript
const context: AgentContext = {
  userPreferences: session.user_preferences || {}  // 从会话获取
}
```

**重构后**:
```typescript
// 从用户资料统一获取偏好
const { data: profile } = await supabase
  .from('profiles')
  .select('travel_preferences')
  .eq('id', userId)
  .single()

const context: AgentContext = {
  userPreferences: profile.travel_preferences || {}
}
```

### 2. **Agent 消息存储对齐**
**现状** (`ReactAgent.saveMessage`):
```typescript
await this.supabase.from('agent_messages').insert({
  agent_run_id: this.agentRunId,
  turn_number: turnNumber, 
  message_type: messageType,  // 'thought'|'action'|'observation'|'answer'
  content,
  metadata: {}
})
```

**重构后**: 保持完全一致，无需修改

### 3. **工具调用存储对齐**
**现状** (`ReactAgent.run`):
```typescript
await this.supabase.from('agent_tool_calls').insert({
  agent_run_id: this.agentRunId,
  turn_number: turn + 1,
  tool_name: action.action,
  tool_input: action.actionInput, 
  tool_output: JSON.stringify(toolResult.payload),
  observation: toolResult.observation,
  execution_time_ms: executionTime
})
```

**重构后**: 保持完全一致，无需修改

### 4. **会话-行程关系对齐**
**现状**: `conversation_sessions.itinerary_id` → `itineraries.id`

**重构后**: `itinerary_cards.session_id` → `conversation_sessions.id` (反向关联+唯一约束)

### 5. **行程数据存储对齐**
**现状**: 分散在 `itineraries` + `itinerary_days` + `itinerary_activities`

**重构后**: 统一存储在 `itinerary_cards.plan_data` (基于 `agentTools.extractPlanStructure`)

---

## 📋 需要修改的服务代码

### 1. **ReactAgent.createReactAgent** 
```typescript
// 修改用户偏好获取逻辑
const { data: profile } = await supabase
  .from('profiles') 
  .select('travel_preferences')
  .eq('id', userId)

const context: AgentContext = {
  userPreferences: profile?.travel_preferences || {}
}
```

### 2. **itineraryService.ts**
```typescript
// 修改行程查询逻辑
const getItineraryCard = async (sessionId: string) => {
  return await supabase
    .from('itinerary_cards')
    .select('*')
    .eq('session_id', sessionId) 
    .single()
}

// 修改行程保存逻辑 
const saveItineraryCard = async (sessionId: string, planData: ItineraryCard) => {
  return await supabase
    .from('itinerary_cards')
    .upsert({
      session_id: sessionId,
      plan_data: planData,
      title: planData.title,
      destination: planData.destination
      // ... 其他冗余字段
    })
}
```

### 3. **conversationService.ts** (新增)
```typescript
// 对话历史管理
const getConversationHistory = async (sessionId: string) => {
  const { data: runs } = await supabase
    .from('agent_runs')
    .select('user_message, final_answer, created_at')
    .eq('session_id', sessionId)
    .eq('status', 'completed')
    .order('created_at')
    
  return runs.flatMap(run => [
    { role: 'user', content: run.user_message, timestamp: run.created_at },
    { role: 'assistant', content: run.final_answer, timestamp: run.created_at }
  ])
}
```

这个重构设计完全基于现有 ReactAgent 代码的实现逻辑，确保了与代码的完美对齐，为后续的服务层重构提供了准确的指导。