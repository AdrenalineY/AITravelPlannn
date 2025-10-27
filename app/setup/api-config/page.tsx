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
        // 验证地图
        if (!values.map?.apiKey) {
          message.error('请输入地图 API 密钥')
          return false
        }

        const response = await fetch('/api/validate/map', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: values.map.provider || 'amap',
            apiKey: values.map.apiKey,
          }),
        })

        const data = await response.json()
        
        if (data.success) {
          message.success('地图 API 验证成功')
          isValid = true
        } else {
          message.error(`地图 API 验证失败: ${data.error}`)
          return false
        }
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
      const finalConfig = { ...config!, ...form.getFieldsValue() } as APIConfig

      await configService.saveConfig(user!.id, finalConfig)
      await configService.markConfigComplete(user!.id)

      message.success('配置保存成功!')
      
      // 更新用户配置状态
      const configStatus = await configService.checkConfigCompleteness(user!.id)
      useAuthStore.setState({
        user: user ? { ...user, configStatus, isNewUser: false } : null,
      })

      router.push('/dashboard')
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
                  label="API Key"
                  name={['map', 'apiKey']}
                  rules={[{ required: true, message: '请输入地图 API 密钥' }]}
                  extra={
                    form.getFieldValue(['map', 'provider']) === 'amap' 
                      ? "⚠️ 请使用「Web服务」平台的Key,不要使用「Web端(JS API)」的Key。申请地址: https://console.amap.com/dev/key/app"
                      : "用于 POI 搜索和路线规划"
                  }
                >
                  <Input.Password placeholder="xxxxxxxxxx" />
                </Form.Item>
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
