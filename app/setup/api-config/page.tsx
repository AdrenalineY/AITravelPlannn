'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Steps,
  Form,
  Input,
  Select,
  Button,
  Card,
  message,
  Alert,
  Space,
  Spin,
  Tag,
} from 'antd'
import {
  CheckCircleOutlined,
  LoadingOutlined,
  ApiOutlined,
  SoundOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'
import { useConfigStore } from '@/store/configStore'
import { configService } from '@/services/configService'
import type { APIConfig } from '@/types'

const { Step } = Steps
const { Option } = Select

export default function APIConfigPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const {
    config,
    progress,
    validationResults,
    isValidating,
    isSaving,
    setConfig,
    setProgress,
    setValidationResult,
    setIsValidating,
    setIsSaving,
  } = useConfigStore()

  const [currentStep, setCurrentStep] = useState(0)
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    loadConfig()
  }, [user])

  const loadConfig = async () => {
    try {
      setLoading(true)
      const savedConfig = await configService.loadConfig(user!.id)
      if (savedConfig) {
        setConfig(savedConfig)
        form.setFieldsValue(savedConfig)
      }

      const configProgress = await configService.getConfigProgress(user!.id)
      setProgress(configProgress)

      // 根据进度设置当前步骤
      if (configProgress.currentStep === 'speech') setCurrentStep(1)
      else if (configProgress.currentStep === 'map') setCurrentStep(2)
    } catch (error: any) {
      message.error('加载配置失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const validateCurrentStep = async () => {
    try {
      setIsValidating(true)
      await form.validateFields()

      const values = form.getFieldsValue()

      // 只验证当前步骤的配置
      let isValid = false
      let validationError = ''

      if (currentStep === 0) {
        // 验证 LLM
        if (!values.llm?.apiKey) {
          message.error('请输入 LLM API 密钥')
          return false
        }

        const response = await fetch('/api/validate/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: values.llm.provider || 'aliyun',
            apiKey: values.llm.apiKey,
            baseUrl: values.llm.baseUrl,
            model: values.llm.model,
          }),
        })

        const data = await response.json()
        
        if (data.success) {
          message.success('LLM API 验证成功')
          isValid = true
        } else {
          message.error(`LLM API 验证失败: ${data.error}`)
          return false
        }
      } else if (currentStep === 1) {
        // 验证语音 (可选)
        if (!values.speech?.apiKey) {
          message.warning('语音 API 密钥为空，语音功能将不可用')
          isValid = true // 语音是可选的，允许跳过
        } else {
          const response = await fetch('/api/validate/speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: values.speech.provider || 'xunfei',
              apiKey: values.speech.apiKey,
              appId: values.speech.appId,
              apiSecret: values.speech.apiSecret,
            }),
          })

          const data = await response.json()
          
          if (data.success) {
            message.success('语音 API 验证成功')
            isValid = true
          } else {
            message.warning(`语音 API 验证失败: ${data.error}，可继续但语音功能不可用`)
            isValid = true // 语音验证失败仍可继续
          }
        }
      } else if (currentStep === 2) {
        // 验证地图 (检查必填的两个 Key)
        if (!values.map?.webServiceKey) {
          message.error('请输入 Web服务 API Key')
          return false
        }
        if (!values.map?.jsApiKey) {
          message.error('请输入 Web端(JS API) Key')
          return false
        }

        // 只验证 Web服务 Key (通过后端 API 调用)
        // JS API Key 无法在后端验证,因为它专门用于前端 JavaScript
        const webServiceResponse = await fetch('/api/validate/map', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: values.map.provider || 'amap',
            apiKey: values.map.webServiceKey,
          }),
        })

        const webServiceData = await webServiceResponse.json()
        
        if (!webServiceData.success) {
          message.error(`Web服务 API Key 验证失败: ${webServiceData.error}`)
          return false
        }

        // JS API Key 只检查格式(长度应该大于 20 位)
        if (values.map.jsApiKey.length < 20) {
          message.error('Web端(JS API) Key 格式不正确,长度过短')
          return false
        }

        message.success('地图配置验证成功 (Web服务 Key 已验证, JS API Key 将在地图加载时验证)')
        isValid = true
      }

      return isValid
    } catch (error: any) {
      console.error('验证失败:', error)
      message.error('验证过程出错: ' + error.message)
      return false
    } finally {
      setIsValidating(false)
    }
  }

  const onNext = async () => {
    const isValid = await validateCurrentStep()
    if (!isValid) return

    const values = form.getFieldsValue()
    setConfig({ ...config!, ...values } as APIConfig)

    if (currentStep < 2) {
      setCurrentStep(currentStep + 1)
    } else {
      await handleSubmit()
    }
  }

  const onPrev = () => {
    setCurrentStep(currentStep - 1)
  }

  const handleSubmit = async () => {
    try {
      setIsSaving(true)
      console.log('[API Config] 开始保存配置...')
      console.log('[API Config] 当前用户:', user)
      console.log('[API Config] 用户ID:', user?.id)
      
      const finalConfig = { ...config!, ...form.getFieldsValue() } as APIConfig
      console.log('[API Config] 最终配置:', finalConfig)

      console.log('[API Config] 调用 saveConfig...')
      await configService.saveConfig(user!.id, finalConfig)
      console.log('[API Config] saveConfig 成功')
      
      console.log('[API Config] 调用 markConfigComplete...')
      await configService.markConfigComplete(user!.id)
      console.log('[API Config] markConfigComplete 成功')

      // 更新 ConfigStore 中的配置
      setConfig(finalConfig)

      message.success('配置保存成功!')
      
      // 更新用户配置状态
      const configStatus = await configService.checkConfigCompleteness(user!.id)
      useAuthStore.setState({
        user: user ? { ...user, configStatus, isNewUser: false } : null,
      })

      // 延迟跳转,确保状态更新完成
      setTimeout(() => {
        router.push('/dashboard')
      }, 500)
    } catch (error: any) {
      message.error('保存配置失败: ' + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spin size="large" tip="加载配置中..." />
      </div>
    )
  }

  const steps = [
    {
      title: 'LLM 配置',
      icon: <ApiOutlined />,
      description: 'AI 对话服务',
    },
    {
      title: '语音配置',
      icon: <SoundOutlined />,
      description: '语音识别服务',
    },
    {
      title: '地图配置',
      icon: <EnvironmentOutlined />,
      description: '地图服务',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-center mb-2">
              🔧 API 密钥配置
            </h1>
            <p className="text-center text-gray-500">
              请配置第三方 API 密钥以启用完整功能
            </p>
          </div>

          <Alert
            message="安全提示"
            description="您的 API 密钥将加密存储在云端，仅您可以访问。我们不会使用您的密钥进行任何操作。"
            type="info"
            showIcon
            className="mb-6"
          />

          <Steps current={currentStep} className="mb-8">
            {steps.map((step, index) => (
              <Step
                key={index}
                title={step.title}
                description={step.description}
                icon={
                  index < currentStep ? (
                    <CheckCircleOutlined />
                  ) : index === currentStep && isValidating ? (
                    <LoadingOutlined />
                  ) : (
                    step.icon
                  )
                }
              />
            ))}
          </Steps>

          <Form form={form} layout="vertical" size="large">
            {currentStep === 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">大语言模型配置</h3>
                <Form.Item
                  label="服务提供商"
                  name={['llm', 'provider']}
                  initialValue="aliyun"
                  rules={[{ required: true }]}
                >
                  <Select>
                    <Option value="aliyun">阿里云百炼（推荐）</Option>
                    <Option value="openai">OpenAI GPT</Option>
                    <Option value="baidu">百度千帆</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label="API Key"
                  name={['llm', 'apiKey']}
                  rules={[{ required: true, message: '请输入 LLM API 密钥' }]}
                  extra="用于 AI 对话和行程生成"
                >
                  <Input.Password placeholder="sk-xxxxxxxxxxxx" />
                </Form.Item>

                <Form.Item 
                  label="Base URL（可选）" 
                  name={['llm', 'baseUrl']}
                  extra="默认使用阿里云百炼 OpenAI 兼容接口"
                >
                  <Input placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions" />
                </Form.Item>

                <Form.Item 
                  label="模型名称（可选）" 
                  name={['llm', 'model']}
                  extra="推荐: qwen-turbo, qwen-plus, qwen-max"
                >
                  <Input placeholder="qwen-turbo" />
                </Form.Item>
              </div>
            )}

            {currentStep === 1 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">语音服务配置</h3>
                <Form.Item
                  label="服务提供商"
                  name={['speech', 'provider']}
                  initialValue="xunfei"
                  rules={[{ required: true }]}
                >
                  <Select>
                    <Option value="xunfei">科大讯飞（推荐）</Option>
                    <Option value="baidu">百度语音</Option>
                    <Option value="aliyun">阿里云智能语音</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label="API Key"
                  name={['speech', 'apiKey']}
                  rules={[{ required: true, message: '请输入语音 API 密钥' }]}
                  extra="用于语音转文字和语音记账"
                >
                  <Input.Password placeholder="xxxxxxxxxx" />
                </Form.Item>

                <Form.Item label="App ID（可选）" name={['speech', 'appId']}>
                  <Input placeholder="应用 ID" />
                </Form.Item>

                <Form.Item label="API Secret（可选）" name={['speech', 'apiSecret']}>
                  <Input.Password placeholder="API Secret" />
                </Form.Item>
              </div>
            )}

            {currentStep === 2 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">地图服务配置</h3>
                <Alert
                  message="高德地图需要两种 API Key"
                  description={
                    <div>
                      <p>1. <strong>Web服务 API Key</strong>: 用于 POI 搜索、路线规划等后端数据获取</p>
                      <p>2. <strong>Web端(JS API) Key</strong>: 用于前端地图显示和交互</p>
                      <p className="mt-2">两种 Key 在高德开放平台的<strong>不同应用类型</strong>中创建</p>
                      <a href="https://console.amap.com/dev/key/app" target="_blank" rel="noopener noreferrer">
                        前往高德开放平台创建 →
                      </a>
                    </div>
                  }
                  type="info"
                  showIcon
                  className="mb-4"
                />

                <Form.Item
                  label="服务提供商"
                  name={['map', 'provider']}
                  initialValue="amap"
                  rules={[{ required: true }]}
                >
                  <Select>
                    <Option value="amap">高德地图（推荐）</Option>
                    <Option value="baidu">百度地图</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label={
                    <span>
                      Web服务 API Key 
                      <Tag color="blue" className="ml-2">后端数据</Tag>
                    </span>
                  }
                  name={['map', 'webServiceKey']}
                  rules={[{ required: true, message: '请输入 Web服务 API Key' }]}
                  extra="用于 POI 搜索、路线规划、地理编码等数据获取。创建时选择「Web服务」应用类型"
                >
                  <Input.Password placeholder="请输入 Web服务 API Key" />
                </Form.Item>

                <Form.Item
                  label={
                    <span>
                      Web端(JS API) Key
                      <Tag color="green" className="ml-2">前端显示</Tag>
                    </span>
                  }
                  name={['map', 'jsApiKey']}
                  rules={[{ required: true, message: '请输入 Web端(JS API) Key' }]}
                  extra="用于前端地图显示、标记、交互等。创建时选择「Web端(JS API)」应用类型。注意：此 Key 仅在地图实际加载时验证"
                >
                  <Input.Password placeholder="请输入 Web端(JS API) Key" />
                </Form.Item>

                <Form.Item
                  label={
                    <span>
                      安全密钥 (Security Code)
                      <Tag color="orange" className="ml-2">可选</Tag>
                    </span>
                  }
                  name={['map', 'securityCode']}
                  rules={[{ required: false }]}
                  extra="高德地图 JS API 的安全密钥,在应用管理中配置。推荐填写以提高安全性"
                >
                  <Input.Password placeholder="请输入安全密钥（可选）" />
                </Form.Item>

                <Alert
                  message="如何配置安全密钥？"
                  description={
                    <ol className="list-decimal ml-4 space-y-1">
                      <li>访问高德开放平台控制台</li>
                      <li>找到「Web端(JS API)」应用</li>
                      <li>在应用设置中找到「安全密钥」配置项</li>
                      <li>生成或设置安全密钥,然后在此处填写</li>
                      <li>安全密钥用于防止 API Key 被盗用</li>
                    </ol>
                  }
                  type="info"
                  showIcon
                  className="mb-4"
                />

                <Alert
                  message="如何创建 API Key？"
                  description={
                    <ol className="list-decimal ml-4 space-y-1">
                      <li>访问高德开放平台控制台 (https://console.amap.com/dev/key/app)</li>
                      <li>创建第一个应用,选择「Web服务」类型,获取 Web服务 Key (用于后端验证)</li>
                      <li>创建第二个应用,选择「Web端(JS API)」类型,获取 JS API Key (用于前端显示)</li>
                      <li>在 JS API Key 的应用中配置「安全密钥」(可选但推荐)</li>
                      <li><strong>注意：</strong>配置时只验证 Web服务 Key，JS API Key 将在地图实际加载时验证</li>
                    </ol>
                  }
                  type="warning"
                  showIcon
                  className="mt-4"
                />
              </div>
            )}

            <div className="flex justify-between mt-8">
              {currentStep > 0 && (
                <Button onClick={onPrev} disabled={isValidating || isSaving}>
                  上一步
                </Button>
              )}
              <div className="flex-1" />
              <Space>
                <Button
                  type="primary"
                  onClick={onNext}
                  loading={isValidating || isSaving}
                >
                  {currentStep < 2 ? '下一步' : '完成配置'}
                </Button>
              </Space>
            </div>
          </Form>
        </Card>
      </div>
    </div>
  )
}
