# 纯前端 AI 旅行规划师界面开发详细规格

## 1. 项目架构概述

### 1.1 纯前端架构特点
- **🌐 单页面应用**：基于 Next.js 14 的纯前端 SPA 架构
- **☁️ 云端数据存储**：使用 Supabase 实现用户数据和行程同步
- **🔗 API 直连**：前端直接调用第三方 API（语音、地图、AI）
- **🔑 用户配置管理**：API 密钥由用户自主配置和管理
- **📱 PWA 支持**：支持离线缓存和原生应用体验

### 1.2 技术栈
- **前端框架**：Next.js 14 + React 18 + TypeScript
- **UI 库**：Ant Design 5.x + Tailwind CSS 3.x
- **状态管理**：Zustand 4.x（轻量级状态管理）
- **地图引擎**：Mapbox GL JS 2.x
- **音频处理**：Web Audio API + MediaRecorder API
- **数据存储**：Supabase（PostgreSQL + Auth + Storage）

## 2. 核心界面设计

### 界面1：首次使用向导（Setup Wizard）
**文件位置**：`/pages/setup/index.tsx`
**功能描述**：首次使用时的配置向导，引导用户设置 API 密钥
**核心组件**：
- 欢迎介绍页面
- API 配置步骤引导
- 配置验证和测试
- 完成设置跳转

**技术实现**：
```typescript
// 设置向导状态管理
interface SetupWizardState {
  currentStep: number;
  totalSteps: number;
  apiConfig: APIConfig;
  validationResults: Record<string, boolean>;
  isValidating: boolean;
}

// API 配置接口
interface APIConfig {
  llm: {
    provider: 'aliyun' | 'openai';
    apiKey: string;
    baseUrl?: string;
  };
  speech: {
    provider: 'xunfei' | 'baidu';
    apiKey: string;
    appId?: string;
    secret?: string;
  };
  map: {
    provider: 'amap' | 'baidu';
    apiKey: string;
  };
}

const SetupWizard = () => {
  const [setupState, setSetupState] = useZustand(setupStore);
  
  const validateApiConfig = async (config: APIConfig) => {
    setSetupState({ isValidating: true });
    
    // 验证各个 API 配置
    const results = await Promise.all([
      validateLLMConfig(config.llm),
      validateSpeechConfig(config.speech),
      validateMapConfig(config.map)
    ]);
    
    setSetupState({ 
      validationResults: {
        llm: results[0],
        speech: results[1],
        map: results[2]
      },
      isValidating: false 
    });
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <Steps current={setupState.currentStep} className="mb-8">
        <Step title="欢迎" description="了解系统功能" />
        <Step title="API 配置" description="设置第三方服务" />
        <Step title="验证测试" description="确认配置有效" />
        <Step title="完成设置" description="开始使用" />
      </Steps>
      
      <div className="max-w-4xl mx-auto p-6">
        {setupState.currentStep === 0 && <WelcomeStep />}
        {setupState.currentStep === 1 && <APIConfigStep />}
        {setupState.currentStep === 2 && <ValidationStep />}
        {setupState.currentStep === 3 && <CompletionStep />}
      </div>
    </div>
  );
};
```

### 界面2：登录界面（Login Page）
**文件位置**：`/pages/auth/login.tsx`
**功能描述**：用户认证入口，基于 Supabase Auth 的登录注册
**核心组件**：
- 登录表单（邮箱/密码）
- 注册切换
- 忘记密码链接
- 第三方登录（可选）

**技术实现**：
```typescript
// 认证状态管理
interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

// Supabase Auth 集成
const AuthPage = () => {
  const [authState, setAuthState] = useZustand(authStore);
  const [form] = Form.useForm();
  const router = useRouter();
  
  const handleLogin = async (values: LoginFormValues) => {
    setAuthState({ loading: true, error: null });
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password
      });
      
      if (error) throw error;
      
      setAuthState({ 
        user: data.user, 
        session: data.session,
        loading: false 
      });
      
      router.push('/dashboard');
    } catch (error) {
      setAuthState({ 
        error: error.message, 
        loading: false 
      });
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">AI 旅行规划师</h1>
          <p className="text-gray-600 mt-2">开始您的智能旅行规划之旅</p>
        </div>
        
        <Form form={form} onFinish={handleLogin} layout="vertical">
          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' }
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="your@email.com" />
          </Form.Item>
          
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="请输入密码" 
            />
          </Form.Item>
          
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              className="w-full"
              loading={authState.loading}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
        
        {authState.error && (
          <Alert 
            message={authState.error} 
            type="error" 
            className="mt-4" 
          />
        )}
      </Card>
    </div>
  );
};
```

### 界面3：主界面（Main Dashboard）
**文件位置**：`/pages/dashboard/index.tsx`
**功能描述**：核心工作界面，采用可调节的左右分栏布局，集成地图和 AI 对话
**整体布局**：
- **左侧主体区域（可调节宽度，默认70%）**：交互式地图界面
- **右侧操作区域（可调节宽度，默认30%）**：AI 对话与功能面板
- **分隔条**：支持拖拽调整左右面板宽度比例
- **顶部导航栏**：用户信息、设置入口、API 状态指示器

#### 3.1 左侧地图界面（Map Panel）
**核心组件**：
- 全屏地图容器（Mapbox GL JS + 高德地图 API）
- 行程路线绘制与动画效果
- POI 标记和详情弹窗
- 地图工具栏（缩放、定位、图层切换）
- 行程时间轴浮动面板
- API 状态指示器

**技术实现**：
```typescript
// 地图状态管理
interface MapState {
  viewport: Viewport;
  currentItinerary: Itinerary | null;
  selectedPOI: POI | null;
  routeData: RouteData[];
  mapStyle: 'streets' | 'satellite' | 'traffic';
  apiStatus: Record<string, 'connected' | 'error' | 'loading'>;
  isLoading: boolean;
}

// 地图服务客户端
class MapService {
  private amapClient: AMapClient;
  
  constructor(apiKey: string) {
    this.amapClient = new AMapClient(apiKey);
  }
  
  async searchPOI(query: string, location: Location): Promise<POI[]> {
    try {
      const response = await this.amapClient.textSearch({
        keywords: query,
        location: `${location.lng},${location.lat}`,
        radius: 10000
      });
      return this.formatPOIData(response.pois);
    } catch (error) {
      console.error('POI search failed:', error);
      throw new Error('地图搜索服务暂时不可用');
    }
  }
  
  async planRoute(origin: Location, destination: Location): Promise<Route> {
    const response = await this.amapClient.drivingRoute({
      origin: `${origin.lng},${origin.lat}`,
      destination: `${destination.lng},${destination.lat}`,
      extensions: 'all'
    });
    return this.formatRouteData(response.route);
  }
}

// 地图组件实现
const MapPanel = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapState, setMapState] = useZustand(mapStore);
  const [apiConfig] = useZustand(configStore);
  const mapServiceRef = useRef<MapService | null>(null);
  
  useEffect(() => {
    // 初始化地图服务
    if (apiConfig.map.apiKey) {
      mapServiceRef.current = new MapService(apiConfig.map.apiKey);
      setMapState({ apiStatus: { ...mapState.apiStatus, map: 'connected' } });
    }
    
    // 初始化 Mapbox GL JS
    const map = new mapboxgl.Map({
      container: mapContainer.current!,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [116.4074, 39.9042], // 北京天安门
      zoom: 10,
      pitch: 45,
      bearing: 0
    });
    
    map.on('load', () => {
      // 添加行程路线图层
      if (mapState.currentItinerary) {
        addItineraryLayers(map, mapState.currentItinerary);
      }
      
      // 添加 POI 标记
      if (mapState.selectedPOI) {
        addPOIMarkers(map, [mapState.selectedPOI]);
      }
    });
    
    // 地图点击事件
    map.on('click', async (e) => {
      if (!mapServiceRef.current) return;
      
      try {
        const pois = await mapServiceRef.current.searchPOI(
          '景点',
          { lng: e.lngLat.lng, lat: e.lngLat.lat }
        );
        
        if (pois.length > 0) {
          setMapState({ selectedPOI: pois[0] });
          showPOIPopup(map, pois[0], e.lngLat);
        }
      } catch (error) {
        message.error('获取位置信息失败');
      }
    });
    
    return () => map.remove();
  }, [apiConfig.map.apiKey]);
  
  return (
    <div className="h-full w-full relative">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* 地图工具栏 */}
      <div className="absolute top-4 left-4 z-10">
        <Space direction="vertical">
          <Button.Group>
            <Button icon={<ZoomInOutlined />} />
            <Button icon={<ZoomOutOutlined />} />
            <Button icon={<AimOutlined />} />
          </Button.Group>
          
          {/* API 状态指示器 */}
          <div className="bg-white rounded p-2 shadow">
            <Space>
              <Badge 
                status={mapState.apiStatus.map === 'connected' ? 'success' : 'error'} 
                text="地图服务" 
              />
            </Space>
          </div>
        </Space>
      </div>
      
      {/* 行程时间轴 */}
      {mapState.currentItinerary && (
        <ItineraryTimeline 
          itinerary={mapState.currentItinerary}
          onDaySelect={(dayIndex) => {
            // 地图聚焦到对应天的行程
            focusMapOnDay(mapState.currentItinerary!.days[dayIndex]);
          }}
        />
      )}
      
      {/* 加载指示器 */}
      {mapState.isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-20">
          <Spin size="large" />
        </div>
      )}
    </div>
  );
};
```

#### 3.2 右侧对话与操作面板（Chat & Control Panel）
**核心组件**：
- **AI 助手头像与状态**：显示 AI 服务连接状态和功能介绍
- **对话消息区域**：支持文本和语音的智能对话界面
- **语音交互控件**：录音按钮、波形显示、语音转文本状态
- **快捷操作面板**：新建行程、历史记录、偏好设置、API 配置
- **行程信息卡片**：当前生成的行程详情和编辑功能
- **底部工具栏**：用户资料、设置、帮助入口

**技术实现**：
```typescript
// 主界面布局状态管理
interface DashboardLayoutState {
  leftPanelWidth: number; // 左侧面板宽度百分比（默认 70%）
  rightPanelWidth: number; // 右侧面板宽度百分比（默认 30%）
  isResizing: boolean; // 是否正在调整大小
  minLeftWidth: number; // 左侧面板最小宽度（30%）
  minRightWidth: number; // 右侧面板最小宽度（25%）
}

// AI 服务客户端
class AIService {
  private apiKey: string;
  private baseUrl: string;
  
  constructor(config: { apiKey: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://dashscope.aliyuncs.com/api/v1';
  }
  
  async chatWithAI(message: string, context: ChatContext): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/services/aigc/text-generation/generation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'qwen-max',
          input: {
            messages: [
              ...context.history,
              { role: 'user', content: message }
            ]
          },
          parameters: {
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 2000
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`AI 服务响应错误: ${response.status}`);
      }
      
      const data = await response.json();
      return data.output.text;
    } catch (error) {
      console.error('AI 服务调用失败:', error);
      throw new Error('AI 助手暂时不可用，请检查网络连接或 API 配置');
    }
  }
}

// 可调节布局组件
const ResizableLayout = () => {
  const [layout, setLayout] = useZustand(layoutStore);
  const [isDragging, setIsDragging] = useState(false);
  
  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const containerWidth = window.innerWidth;
    const newLeftWidth = (e.clientX / containerWidth) * 100;
    
    // 限制最小和最大宽度
    const clampedLeftWidth = Math.max(
      layout.minLeftWidth,
      Math.min(100 - layout.minRightWidth, newLeftWidth)
    );
    
    setLayout({
      leftPanelWidth: clampedLeftWidth,
      rightPanelWidth: 100 - clampedLeftWidth
    });
  }, [isDragging, layout]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // 保存用户偏好到本地存储
    localStorage.setItem('layout-preference', JSON.stringify({
      leftPanelWidth: layout.leftPanelWidth,
      rightPanelWidth: layout.rightPanelWidth
    }));
  }, [layout]);
  
  return (
    <div className="flex h-screen bg-gray-100">
      {/* 顶部导航栏 */}
      <TopNavigation />
      
      {/* 主体内容区域 */}
      <div className="flex flex-1">
        {/* 左侧地图面板 */}
        <div 
          style={{ width: `${layout.leftPanelWidth}%` }} 
          className="relative border-r border-gray-200"
        >
          <MapPanel />
        </div>
        
        {/* 可拖拽分隔条 */}
        <div
          className={`w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize transition-colors ${
            isDragging ? 'bg-blue-500' : ''
          }`}
          onMouseDown={handleMouseDown}
        >
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-px h-8 bg-white opacity-60"></div>
          </div>
        </div>
        
        {/* 右侧对话面板 */}
        <div 
          style={{ width: `${layout.rightPanelWidth}%` }} 
          className="relative bg-white"
        >
          <ChatPanel />
        </div>
      </div>
    </div>
  );
};

// 语音服务客户端
class VoiceService {
  private apiKey: string;
  private appId: string;
  private apiSecret: string;
  
  constructor(config: { apiKey: string; appId: string; apiSecret: string }) {
    this.apiKey = config.apiKey;
    this.appId = config.appId;
    this.apiSecret = config.apiSecret;
  }
  
  async transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
    try {
      // 科大讯飞 WebAPI 调用
      const formData = new FormData();
      formData.append('audio', audioBlob);
      
      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          'X-App-Id': this.appId
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`语音识别失败: ${response.status}`);
      }
      
      const data = await response.json();
      return {
        text: data.text,
        confidence: data.confidence,
        intent: this.parseIntent(data.text)
      };
    } catch (error) {
      console.error('语音识别服务调用失败:', error);
      throw new Error('语音识别服务暂时不可用');
    }
  }
  
  private parseIntent(text: string): VoiceIntent | undefined {
    // 简单的意图识别逻辑
    if (text.includes('行程') || text.includes('规划')) {
      return { action: 'create_itinerary', parameters: { query: text } };
    }
    if (text.includes('费用') || text.includes('花费')) {
      return { action: 'add_expense', parameters: { description: text } };
    }
    return undefined;
  }
}

// 右侧面板状态管理
interface ChatPanelState {
  messages: Message[];
  inputText: string;
  isRecording: boolean;
  isGenerating: boolean;
  showPreferences: boolean;
  currentUser: User | null;
  apiStatus: Record<string, 'connected' | 'error' | 'loading'>;
  voiceRecorder: MediaRecorder | null;
}

const ChatPanel = () => {
  const [panelState, setPanelState] = useZustand(chatStore);
  const [apiConfig] = useZustand(configStore);
  const aiServiceRef = useRef<AIService | null>(null);
  const voiceServiceRef = useRef<VoiceService | null>(null);
  
  useEffect(() => {
    // 初始化 AI 服务
    if (apiConfig.llm.apiKey) {
      aiServiceRef.current = new AIService(apiConfig.llm);
      setPanelState({ 
        apiStatus: { ...panelState.apiStatus, ai: 'connected' } 
      });
    }
    
    // 初始化语音服务
    if (apiConfig.speech.apiKey) {
      voiceServiceRef.current = new VoiceService(apiConfig.speech);
      setPanelState({ 
        apiStatus: { ...panelState.apiStatus, speech: 'connected' } 
      });
    }
  }, [apiConfig]);
  
  const handleSendMessage = async (message: string) => {
    if (!aiServiceRef.current) {
      message.error('请先配置 AI 服务');
      return;
    }
    
    try {
      setPanelState({ isGenerating: true });
      
      // 添加用户消息
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: message,
        timestamp: new Date()
      };
      
      setPanelState({ 
        messages: [...panelState.messages, userMessage],
        inputText: ''
      });
      
      // 调用 AI 服务
      const response = await aiServiceRef.current.chatWithAI(message, {
        history: panelState.messages.slice(-10) // 最近10条消息作为上下文
      });
      
      // 添加 AI 回复
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: response,
        timestamp: new Date()
      };
      
      setPanelState({ 
        messages: [...panelState.messages, userMessage, aiMessage],
        isGenerating: false
      });
      
      // 如果 AI 返回了行程规划，更新地图
      const itinerary = this.parseItineraryFromResponse(response);
      if (itinerary) {
        useZustand.getState().mapStore.setCurrentItinerary(itinerary);
      }
      
    } catch (error) {
      message.error(error.message);
      setPanelState({ isGenerating: false });
    }
  };
  
  const handleVoiceRecording = async () => {
    if (!voiceServiceRef.current) {
      message.error('请先配置语音服务');
      return;
    }
    
    if (!panelState.isRecording) {
      // 开始录音
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const audioChunks: Blob[] = [];
        
        recorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };
        
        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          
          try {
            const result = await voiceServiceRef.current!.transcribeAudio(audioBlob);
            
            if (result.text) {
              await handleSendMessage(result.text);
            }
          } catch (error) {
            message.error('语音识别失败');
          }
          
          stream.getTracks().forEach(track => track.stop());
        };
        
        recorder.start();
        setPanelState({ 
          isRecording: true, 
          voiceRecorder: recorder 
        });
        
      } catch (error) {
        message.error('无法访问麦克风');
      }
    } else {
      // 停止录音
      if (panelState.voiceRecorder) {
        panelState.voiceRecorder.stop();
        setPanelState({ 
          isRecording: false, 
          voiceRecorder: null 
        });
      }
    }
  };
  
  return (
    <div className="h-full flex flex-col bg-white">
      {/* 顶部AI助手信息 */}
      <div className="p-4 border-b bg-gradient-to-r from-blue-500 to-purple-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
              <span className="text-2xl">🤖</span>
            </div>
            <div className="text-white">
              <h3 className="font-medium">AI 旅行助手</h3>
              <p className="text-sm opacity-90">
                智能旅行规划，语音交互体验
              </p>
            </div>
          </div>
          
          {/* API 状态指示器 */}
          <div className="flex space-x-2">
            <Badge 
              status={panelState.apiStatus.ai === 'connected' ? 'success' : 'error'} 
              text="AI" 
            />
            <Badge 
              status={panelState.apiStatus.speech === 'connected' ? 'success' : 'error'} 
              text="语音" 
            />
          </div>
        </div>
      </div>
      
      {/* 对话消息区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {panelState.messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-4xl mb-4">👋</div>
            <p>您好！我是您的 AI 旅行助手</p>
            <p className="text-sm mt-2">告诉我您的旅行需求，我来为您规划完美行程</p>
          </div>
        ) : (
          <MessageList messages={panelState.messages} />
        )}
        
        {panelState.isGenerating && (
          <div className="flex items-center space-x-2 text-gray-500">
            <Spin size="small" />
            <span>AI 正在思考中...</span>
          </div>
        )}
      </div>
      
      {/* 快捷操作区 */}
      <div className="p-4 border-t bg-gray-50">
        <div className="grid grid-cols-4 gap-2 mb-4">
          <Button icon={<PlusOutlined />} size="small">新建</Button>
          <Button icon={<HistoryOutlined />} size="small">历史</Button>
          <Button icon={<SettingOutlined />} size="small">设置</Button>
          <Button icon={<ApiOutlined />} size="small">API</Button>
        </div>
      </div>
      
      {/* 输入区域 */}
      <div className="p-4 border-t">
        <div className="flex space-x-2">
          <Input.TextArea
            value={panelState.inputText}
            onChange={(e) => setPanelState({ inputText: e.target.value })}
            placeholder="告诉我您的旅行需求..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={(e) => {
              if (!e.shiftKey && panelState.inputText.trim()) {
                handleSendMessage(panelState.inputText.trim());
              }
            }}
          />
          <div className="flex flex-col space-y-2">
            <Button
              type={panelState.isRecording ? 'danger' : 'default'}
              icon={panelState.isRecording ? <AudioMutedOutlined /> : <AudioOutlined />}
              onClick={handleVoiceRecording}
              loading={panelState.isRecording}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => handleSendMessage(panelState.inputText.trim())}
              disabled={!panelState.inputText.trim() || panelState.isGenerating}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
```

### 界面4：API 配置管理（API Configuration）
**文件位置**：`/pages/settings/api.tsx`
**功能描述**：用户自主配置和管理各种第三方 API 密钥
**核心组件**：
- API 服务商选择
- 密钥输入和验证
- 配置测试功能
- 配置导入导出

**技术实现**：
```typescript
// API 配置状态管理
interface APIConfigState {
  config: APIConfig;
  validationResults: Record<string, ValidationResult>;
  isValidating: boolean;
  showSecrets: Record<string, boolean>;
}

interface ValidationResult {
  isValid: boolean;
  message: string;
  testedAt: Date;
}

const APIConfigPage = () => {
  const [configState, setConfigState] = useZustand(apiConfigStore);
  const [form] = Form.useForm();
  
  const validateAPIKey = async (service: string, config: any) => {
    setConfigState({ 
      isValidating: true,
      validationResults: {
        ...configState.validationResults,
        [service]: { isValid: false, message: '验证中...', testedAt: new Date() }
      }
    });
    
    try {
      let isValid = false;
      let message = '';
      
      switch (service) {
        case 'llm':
          const testResponse = await fetch('/api/test/llm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
          });
          isValid = testResponse.ok;
          message = isValid ? 'AI 服务连接成功' : 'API 密钥无效或服务不可用';
          break;
          
        case 'speech':
          // 测试语音识别服务
          isValid = await testSpeechService(config);
          message = isValid ? '语音服务连接成功' : '语音服务配置错误';
          break;
          
        case 'map':
          // 测试地图服务
          isValid = await testMapService(config);
          message = isValid ? '地图服务连接成功' : '地图 API 密钥无效';
          break;
      }
      
      setConfigState({
        validationResults: {
          ...configState.validationResults,
          [service]: { isValid, message, testedAt: new Date() }
        }
      });
      
    } catch (error) {
      setConfigState({
        validationResults: {
          ...configState.validationResults,
          [service]: { 
            isValid: false, 
            message: `验证失败: ${error.message}`, 
            testedAt: new Date() 
          }
        }
      });
    } finally {
      setConfigState({ isValidating: false });
    }
  };
  
  const handleSaveConfig = async (values: APIConfig) => {
    try {
      // 使用 Web Crypto API 加密存储
      const encryptedConfig = await encryptConfig(values);
      localStorage.setItem('api-config', encryptedConfig);
      
      setConfigState({ config: values });
      message.success('配置保存成功');
      
      // 验证所有配置
      await Promise.all([
        validateAPIKey('llm', values.llm),
        validateAPIKey('speech', values.speech),
        validateAPIKey('map', values.map)
      ]);
      
    } catch (error) {
      message.error('配置保存失败');
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">API 配置管理</h1>
        <p className="text-gray-600 mt-2">
          配置第三方服务 API 密钥，所有数据将加密存储在您的浏览器本地
        </p>
      </div>
      
      <Form
        form={form}
        layout="vertical"
        initialValues={configState.config}
        onFinish={handleSaveConfig}
      >
        {/* AI 服务配置 */}
        <Card title="AI 服务配置" className="mb-6">
          <Form.Item label="服务提供商" name={['llm', 'provider']}>
            <Select placeholder="选择 AI 服务提供商">
              <Option value="aliyun">阿里云百炼（推荐）</Option>
              <Option value="openai">OpenAI GPT</Option>
              <Option value="baidu">百度千帆</Option>
            </Select>
          </Form.Item>
          
          <Form.Item 
            label="API 密钥" 
            name={['llm', 'apiKey']}
            extra={
              <div className="flex justify-between items-center mt-2">
                <a 
                  href="https://dashscope.console.aliyun.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700"
                >
                  如何获取阿里云百炼 API 密钥？
                </a>
                <Button 
                  size="small"
                  onClick={() => validateAPIKey('llm', form.getFieldValue(['llm']))}
                  loading={configState.isValidating}
                >
                  测试连接
                </Button>
              </div>
            }
          >
            <Input.Password 
              placeholder="请输入 API 密钥"
              visibilityToggle={{
                visible: configState.showSecrets.llm,
                onVisibleChange: (visible) => setConfigState({
                  showSecrets: { ...configState.showSecrets, llm: visible }
                })
              }}
            />
          </Form.Item>
          
          {configState.validationResults.llm && (
            <Alert
              type={configState.validationResults.llm.isValid ? 'success' : 'error'}
              message={configState.validationResults.llm.message}
              showIcon
              className="mb-4"
            />
          )}
        </Card>
        
        {/* 语音服务配置 */}
        <Card title="语音服务配置" className="mb-6">
          <Form.Item label="服务提供商" name={['speech', 'provider']}>
            <Select placeholder="选择语音服务提供商">
              <Option value="xunfei">科大讯飞（推荐）</Option>
              <Option value="baidu">百度语音</Option>
              <Option value="aliyun">阿里云智能语音</Option>
            </Select>
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="App ID" name={['speech', 'appId']}>
                <Input placeholder="请输入 App ID" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="API Key" name={['speech', 'apiKey']}>
                <Input.Password placeholder="请输入 API Key" />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item label="API Secret" name={['speech', 'apiSecret']}>
            <Input.Password placeholder="请输入 API Secret" />
          </Form.Item>
          
          <div className="flex justify-between items-center">
            <a 
              href="https://console.xfyun.cn/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700"
            >
              如何获取科大讯飞 API 密钥？
            </a>
            <Button 
              size="small"
              onClick={() => validateAPIKey('speech', form.getFieldValue(['speech']))}
              loading={configState.isValidating}
            >
              测试连接
            </Button>
          </div>
          
          {configState.validationResults.speech && (
            <Alert
              type={configState.validationResults.speech.isValid ? 'success' : 'error'}
              message={configState.validationResults.speech.message}
              showIcon
              className="mt-4"
            />
          )}
        </Card>
        
        {/* 地图服务配置 */}
        <Card title="地图服务配置" className="mb-6">
          <Form.Item label="服务提供商" name={['map', 'provider']}>
            <Select placeholder="选择地图服务提供商">
              <Option value="amap">高德地图（推荐）</Option>
              <Option value="baidu">百度地图</Option>
            </Select>
          </Form.Item>
          
          <Form.Item 
            label="API 密钥" 
            name={['map', 'apiKey']}
            extra={
              <div className="flex justify-between items-center mt-2">
                <a 
                  href="https://console.amap.com/dev/key/app" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700"
                >
                  如何获取高德地图 API 密钥？
                </a>
                <Button 
                  size="small"
                  onClick={() => validateAPIKey('map', form.getFieldValue(['map']))}
                  loading={configState.isValidating}
                >
                  测试连接
                </Button>
              </div>
            }
          >
            <Input.Password placeholder="请输入 API 密钥" />
          </Form.Item>
          
          {configState.validationResults.map && (
            <Alert
              type={configState.validationResults.map.isValid ? 'success' : 'error'}
              message={configState.validationResults.map.message}
              showIcon
              className="mb-4"
            />
          )}
        </Card>
        
        {/* 操作按钮 */}
        <div className="flex justify-between">
          <Space>
            <Button onClick={() => exportConfig(configState.config)}>
              导出配置
            </Button>
            <Upload
              accept=".json"
              beforeUpload={(file) => {
                importConfig(file);
                return false;
              }}
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />}>导入配置</Button>
            </Upload>
          </Space>
          
          <Space>
            <Button onClick={() => form.resetFields()}>
              重置
            </Button>
            <Button 
              type="primary" 
              htmlType="submit"
              loading={configState.isValidating}
            >
              保存配置
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
};
```

### 界面5：用户偏好设置（User Preferences）
**文件位置**：`/components/PreferenceModal.tsx`
**功能描述**：个性化旅行偏好设置，存储在 Supabase 用户配置中
**核心组件**：
- 旅行风格选择
- 同行人员设置
- 预算范围配置
- 兴趣标签管理

**技术实现**：
```typescript
interface TravelPreferences {
  travelStyle: string[];
  preferredTransportation: string[];
  accommodationType: string[];
  foodPreferences: string[];
  budgetRange: [number, number];
  travelPace: 'relaxed' | 'moderate' | 'intensive';
  interests: string[];
  avoidPlaces: string[];
}

const PreferenceModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  
  const handleSavePreferences = async (values: TravelPreferences) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          preferences: values,
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      message.success('偏好设置保存成功');
      onClose();
    } catch (error) {
      message.error('保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Modal
      title="个性化偏好设置"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={null}
    >
      <Form 
        form={form} 
        layout="vertical" 
        onFinish={handleSavePreferences}
      >
        <Tabs defaultActiveKey="style">
          <TabPane tab="旅行风格" key="style">
            <Form.Item label="旅行风格（可多选）" name="travelStyle">
              <Checkbox.Group>
                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <Checkbox value="cultural">文化历史</Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox value="nature">自然风光</Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox value="food">美食体验</Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox value="adventure">冒险刺激</Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox value="relaxation">休闲度假</Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox value="shopping">购物娱乐</Checkbox>
                  </Col>
                </Row>
              </Checkbox.Group>
            </Form.Item>
            
            <Form.Item label="旅行节奏" name="travelPace">
              <Radio.Group>
                <Radio value="relaxed">悠闲（每天2-3个景点）</Radio>
                <Radio value="moderate">适中（每天3-4个景点）</Radio>
                <Radio value="intensive">紧凑（每天4+个景点）</Radio>
              </Radio.Group>
            </Form.Item>
          </TabPane>
          
          <TabPane tab="交通住宿" key="transport">
            <Form.Item label="偏好交通方式" name="preferredTransportation">
              <Select mode="multiple" placeholder="选择偏好的交通方式">
                <Option value="flight">飞机</Option>
                <Option value="train">火车/高铁</Option>
                <Option value="bus">大巴</Option>
                <Option value="car">自驾</Option>
                <Option value="metro">地铁/公交</Option>
                <Option value="taxi">出租车/网约车</Option>
                <Option value="bike">自行车</Option>
                <Option value="walk">步行</Option>
              </Select>
            </Form.Item>
            
            <Form.Item label="住宿类型偏好" name="accommodationType">
              <Select mode="multiple" placeholder="选择偏好的住宿类型">
                <Option value="hotel">酒店</Option>
                <Option value="hostel">青旅</Option>
                <Option value="bnb">民宿</Option>
                <Option value="resort">度假村</Option>
                <Option value="apartment">公寓</Option>
              </Select>
            </Form.Item>
          </TabPane>
          
          <TabPane tab="预算兴趣" key="budget">
            <Form.Item label="单日预算范围（人民币）" name="budgetRange">
              <Slider
                range
                min={100}
                max={2000}
                step={50}
                marks={{
                  100: '¥100',
                  500: '¥500',
                  1000: '¥1000',
                  2000: '¥2000+'
                }}
              />
            </Form.Item>
            
            <Form.Item label="兴趣爱好" name="interests">
              <Select mode="tags" placeholder="输入您的兴趣爱好">
                <Option value="photography">摄影</Option>
                <Option value="hiking">徒步</Option>
                <Option value="museums">博物馆</Option>
                <Option value="nightlife">夜生活</Option>
                <Option value="local-food">当地美食</Option>
                <Option value="architecture">建筑</Option>
                <Option value="art">艺术</Option>
                <Option value="music">音乐</Option>
              </Select>
            </Form.Item>
            
            <Form.Item label="不喜欢的地方/活动" name="avoidPlaces">
              <Select mode="tags" placeholder="输入想要避免的地方或活动">
                <Option value="crowded">人多拥挤</Option>
                <Option value="expensive">价格昂贵</Option>
                <Option value="noisy">嘈杂环境</Option>
                <Option value="heights">高空项目</Option>
                <Option value="water-sports">水上运动</Option>
              </Select>
            </Form.Item>
          </TabPane>
        </Tabs>
        
        <div className="flex justify-end space-x-4 mt-6">
          <Button onClick={onClose}>
            取消
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            保存偏好
          </Button>
        </div>
      </Form>
    </Modal>
  );
};
```

## 3. 功能测试规范

### 3.1 纯前端 API 集成测试

#### 第三方 API 测试清单
1. **Supabase 集成测试**
   - 用户认证：注册、登录、登出
   - 数据操作：CRUD 操作测试
   - 实时同步：数据变化实时更新
   - 文件上传：语音文件存储测试

2. **AI 服务测试**
   - 阿里云百炼 API 连接测试
   - 对话上下文维护测试
   - 错误处理和重试机制测试
   - 流式响应处理测试

3. **语音服务测试**
   - 科大讯飞 WebAPI 连接测试
   - 音频录制和上传测试
   - 语音识别准确性测试
   - 语音指令解析测试

4. **地图服务测试**
   - 高德地图 API 调用测试
   - POI 搜索功能测试
   - 路线规划功能测试
   - 地图渲染性能测试

### 3.2 用户界面测试

#### 响应式布局测试
```typescript
// 布局测试工具
const LayoutTestSuite = () => {
  const [screenSize, setScreenSize] = useState('desktop');
  const [layout, setLayout] = useZustand(layoutStore);
  
  const testCases = [
    {
      name: '桌面端布局',
      screenWidth: 1920,
      expectedLayout: { leftPanel: '70%', rightPanel: '30%', resizable: true }
    },
    {
      name: '平板端布局',
      screenWidth: 768,
      expectedLayout: { leftPanel: '60%', rightPanel: '40%', resizable: true }
    },
    {
      name: '移动端布局',
      screenWidth: 375,
      expectedLayout: { layout: 'tabs', resizable: false }
    }
  ];
  
  const runLayoutTests = () => {
    testCases.forEach(testCase => {
      // 模拟屏幕尺寸变化
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: testCase.screenWidth
      });
      
      // 触发窗口调整事件
      window.dispatchEvent(new Event('resize'));
      
      // 验证布局适配
      console.log(`测试 ${testCase.name}:`, {
        expected: testCase.expectedLayout,
        actual: getCurrentLayout()
      });
    });
  };
  
  return (
    <div className="p-4">
      <Button onClick={runLayoutTests}>运行布局测试</Button>
    </div>
  );
};

// 面板调节测试
const PanelResizeTest = () => {
  const testResizeFeatures = () => {
    const tests = [
      {
        name: '拖拽调节功能',
        action: () => simulateDragResize(50), // 拖拽到50%
        expect: '面板宽度应调整为50%/50%'
      },
      {
        name: '最小宽度限制',
        action: () => simulateDragResize(20), // 尝试拖拽到20%
        expect: '左侧面板应保持最小宽度30%'
      },
      {
        name: '用户偏好保存',
        action: () => {
          simulateDragResize(65);
          localStorage.getItem('layout-preference');
        },
        expect: '宽度设置应保存到localStorage'
      },
      {
        name: '页面刷新恢复',
        action: () => {
          window.location.reload();
          return getCurrentLayout();
        },
        expect: '刷新后应恢复用户设置的宽度'
      }
    ];
    
    tests.forEach(test => {
      console.log(`测试: ${test.name}`);
      const result = test.action();
      console.log(`期望: ${test.expect}`);
      console.log(`结果: ${JSON.stringify(result)}`);
    });
  };
  
  return (
    <div>
      <Button onClick={testResizeFeatures}>测试面板调节功能</Button>
      <div className="mt-4 text-sm text-gray-600">
        <p>• 左侧最小宽度：30%</p>
        <p>• 右侧最小宽度：25%</p>
        <p>• 支持本地存储用户偏好</p>
        <p>• 响应式断点自动适配</p>
      </div>
    </div>
  );
};
```

### 3.3 API 配置测试

#### API 密钥验证测试
```typescript
const APIValidationTest = () => {
  const testAPIConfigs = async () => {
    const testConfigs = [
      {
        service: 'llm',
        config: { provider: 'aliyun', apiKey: 'test-key' },
        expectedResult: false // 假设测试密钥无效
      },
      {
        service: 'speech',
        config: { provider: 'xunfei', apiKey: 'valid-key', appId: 'test' },
        expectedResult: true
      },
      {
        service: 'map',
        config: { provider: 'amap', apiKey: 'valid-map-key' },
        expectedResult: true
      }
    ];
    
    for (const test of testConfigs) {
      console.log(`测试 ${test.service} API 配置...`);
      
      try {
        const result = await validateAPIConfig(test.service, test.config);
        const passed = result.isValid === test.expectedResult;
        
        console.log(`${test.service} 测试${passed ? '通过' : '失败'}`);
        console.log(`期望: ${test.expectedResult}, 实际: ${result.isValid}`);
        console.log(`消息: ${result.message}`);
      } catch (error) {
        console.error(`${test.service} 测试出错:`, error);
      }
    }
  };
  
  return (
    <div>
      <Button onClick={testAPIConfigs}>测试 API 配置验证</Button>
    </div>
  );
};
```

### 3.4 端到端测试流程

#### 完整用户流程测试
```typescript
const E2ETestSuite = () => {
  const runE2ETests = async () => {
    const testSteps = [
      {
        name: '首次使用向导',
        action: async () => {
          // 模拟首次访问
          localStorage.clear();
          window.location.href = '/setup';
          await waitForElement('[data-testid="setup-wizard"]');
        }
      },
      {
        name: 'API 配置设置',
        action: async () => {
          await fillForm({
            'llm.provider': 'aliyun',
            'llm.apiKey': 'test-api-key',
            'speech.provider': 'xunfei',
            'map.apiKey': 'test-map-key'
          });
          await clickButton('保存配置');
        }
      },
      {
        name: '用户注册登录',
        action: async () => {
          await navigateTo('/auth/login');
          await fillForm({
            email: 'test@example.com',
            password: 'testpassword123'
          });
          await clickButton('登录');
        }
      },
      {
        name: '主界面交互',
        action: async () => {
          await waitForElement('[data-testid="main-dashboard"]');
          await waitForElement('[data-testid="map-container"]');
          await waitForElement('[data-testid="chat-panel"]');
        }
      },
      {
        name: '语音交互测试',
        action: async () => {
          const voiceButton = await waitForElement('[data-testid="voice-button"]');
          await clickElement(voiceButton);
          // 模拟语音输入
          await simulateVoiceInput('我想去北京旅行三天');
        }
      },
      {
        name: 'AI 对话测试',
        action: async () => {
          await waitForResponse('[data-testid="ai-response"]');
          await verifyElement('[data-testid="itinerary-card"]');
        }
      },
      {
        name: '地图联动测试',
        action: async () => {
          await waitForMapUpdate();
          await verifyMapMarkers();
          await verifyRouteDisplay();
        }
      }
    ];
    
    for (const step of testSteps) {
      console.log(`执行测试步骤: ${step.name}`);
      try {
        await step.action();
        console.log(`✅ ${step.name} 通过`);
      } catch (error) {
        console.error(`❌ ${step.name} 失败:`, error);
        break;
      }
    }
  };
  
  return (
    <div>
      <Button onClick={runE2ETests}>运行端到端测试</Button>
    </div>
  );
};
```

### 3.5 性能测试

#### 前端性能监控
```typescript
const PerformanceTest = () => {
  const runPerformanceTests = () => {
    // 页面加载性能
    const navigationTiming = performance.getEntriesByType('navigation')[0];
    console.log('页面加载时间:', {
      DOMContentLoaded: navigationTiming.domContentLoadedEventEnd - navigationTiming.domContentLoadedEventStart,
      完全加载: navigationTiming.loadEventEnd - navigationTiming.loadEventStart
    });
    
    // API 调用性能
    const apiCalls = performance.getEntriesByType('resource')
      .filter(entry => entry.name.includes('api'))
      .map(entry => ({
        url: entry.name,
        duration: entry.duration,
        size: entry.transferSize
      }));
    
    console.log('API 调用性能:', apiCalls);
    
    // 内存使用情况
    if ('memory' in performance) {
      console.log('内存使用:', performance.memory);
    }
    
    // 地图渲染性能
    const mapRenderTime = measureMapRenderTime();
    console.log('地图渲染时间:', mapRenderTime);
  };
  
  return (
    <div>
      <Button onClick={runPerformanceTests}>运行性能测试</Button>
    </div>
  );
};
```

## 4. 部署和测试环境

### 4.1 开发环境配置
```powershell
# 启动开发服务器
npm run dev

# 运行测试
npm run test

# 类型检查
npm run type-check

# 代码检查
npm run lint
```

### 4.2 预览和构建测试
```powershell
# 构建应用
npm run build

# 本地预览构建结果
npm run start

# 运行端到端测试
npm run e2e
```

### 4.3 测试覆盖率
```powershell
# 生成测试覆盖率报告
npm run test:coverage

# 查看覆盖率报告
open coverage/lcov-report/index.html
```

该规格为纯前端 AI 旅行规划师的开发和测试提供了完整的指导，确保应用的稳定性、性能和用户体验。