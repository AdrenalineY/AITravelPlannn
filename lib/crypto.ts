/**
 * Web Crypto API 加密工具
 * 用于在客户端加密和解密 API 密钥
 */

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256

/**
 * 从用户密码派生加密密钥
 */
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  )
}

/**
 * 生成随机盐
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16))
}

/**
 * 生成随机 IV
 */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12))
}

/**
 * 加密文本
 */
export async function encrypt(text: string, key: CryptoKey): Promise<string> {
  const enc = new TextEncoder()
  const iv = generateIV()
  
  const encrypted = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv as BufferSource,
    },
    key,
    enc.encode(text)
  )

  // 将 IV 和加密数据组合
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)

  // 转换为 Base64
  return btoa(String.fromCharCode(...combined))
}

/**
 * 解密文本
 */
export async function decrypt(encryptedData: string, key: CryptoKey): Promise<string> {
  try {
    // 从 Base64 解码
    const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0))
    
    // 提取 IV 和加密数据
    const iv = combined.slice(0, 12)
    const encrypted = combined.slice(12)

    const decrypted = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv as BufferSource,
      },
      key,
      encrypted
    )

    const dec = new TextDecoder()
    return dec.decode(decrypted)
  } catch (error) {
    console.error('Decryption failed:', error)
    throw new Error('解密失败，请检查密钥是否正确')
  }
}

/**
 * 存储加密密钥（以用户 ID 为盐）
 */
export async function storeEncryptionKey(userId: string, password: string): Promise<void> {
  const salt = generateSalt()
  const key = await deriveKey(password, salt)
  
  // 导出密钥用于存储
  const exportedKey = await crypto.subtle.exportKey('raw', key)
  const keyArray = new Uint8Array(exportedKey)

  // 存储盐和密钥
  localStorage.setItem(`crypto_salt_${userId}`, btoa(String.fromCharCode(...salt)))
  localStorage.setItem(`crypto_key_${userId}`, btoa(String.fromCharCode(...keyArray)))
}

/**
 * 获取加密密钥
 */
export async function getEncryptionKey(userId: string, password: string): Promise<CryptoKey | null> {
  const saltBase64 = localStorage.getItem(`crypto_salt_${userId}`)
  
  if (!saltBase64) {
    return null
  }

  const salt = Uint8Array.from(atob(saltBase64), (c) => c.charCodeAt(0))
  return deriveKey(password, salt)
}

/**
 * 简单加密（用于不需要用户密码的场景，使用用户ID作为密钥）
 */
export async function simpleEncrypt(text: string, userId?: string): Promise<string> {
  // 使用用户ID作为密钥源，如果没有则使用设备ID
  const keySource = userId || getOrCreateDeviceId()
  const salt = generateSalt()
  const key = await deriveKey(keySource, salt)
  
  const encrypted = await encrypt(text, key)
  
  // 将盐和加密数据组合返回
  return btoa(String.fromCharCode(...salt)) + '.' + encrypted
}

/**
 * 简单解密
 */
export async function simpleDecrypt(encryptedData: string, userId?: string): Promise<string> {
  const [saltBase64, encrypted] = encryptedData.split('.')
  const salt = Uint8Array.from(atob(saltBase64), (c) => c.charCodeAt(0))
  
  // 使用用户ID作为密钥源，如果没有则使用设备ID
  const keySource = userId || getOrCreateDeviceId()
  const key = await deriveKey(keySource, salt)
  
  return decrypt(encrypted, key)
}

/**
 * 获取或创建设备 ID
 * 在浏览器中使用 localStorage，在服务器端使用环境变量
 */
function getOrCreateDeviceId(): string {
  // 检查是否在浏览器环境
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    let deviceId = localStorage.getItem('device_id')
    
    if (!deviceId) {
      deviceId = crypto.randomUUID()
      localStorage.setItem('device_id', deviceId)
    }
    
    return deviceId
  }
  
  // 服务器端环境：使用环境变量或固定值
  const serverKey = process.env.CRYPTO_SERVER_KEY || 'default-server-encryption-key-change-in-production'
  return serverKey
}
