/**
 * 用户个人信息 API
 * GET /api/profile - 获取用户个人信息和旅行偏好
 * PUT /api/profile - 更新用户个人信息和旅行偏好
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TravelPreferencesProfile } from '@/types'

/**
 * GET /api/profile
 * 获取用户个人信息和旅行偏好
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    // 从 profiles 表获取用户信息
    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, travel_preferences, created_at, updated_at')
      .eq('id', user.id)
      .single()

    // 如果 profile 不存在，创建一个新的
    if (profileError && profileError.code === 'PGRST116') {
      console.log('[API Profile GET] Profile not found, creating new profile for user:', user.id)
      
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
          travel_preferences: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id, email, full_name, avatar_url, travel_preferences, created_at, updated_at')
        .single()

      if (insertError) {
        console.error('[API Profile GET] Error creating profile:', insertError)
        return NextResponse.json({ error: '创建用户信息失败' }, { status: 500 })
      }

      profile = newProfile
    } else if (profileError) {
      console.error('[API Profile GET] Error loading profile:', profileError)
      return NextResponse.json({ error: '加载用户信息失败' }, { status: 500 })
    }

    // 确保 profile 存在
    if (!profile) {
      return NextResponse.json({ error: '用户信息不存在' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        avatarUrl: profile.avatar_url,
        travelPreferences: profile.travel_preferences || {},
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      }
    })

  } catch (error: any) {
    console.error('[API Profile GET] Unexpected error:', error)
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 })
  }
}

/**
 * PUT /api/profile
 * 更新用户个人信息和旅行偏好
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    // 解析请求体
    const body = await request.json()
    const { travelPreferences, fullName, avatarUrl } = body

    // 验证数据
    if (travelPreferences) {
      const prefs = travelPreferences as TravelPreferencesProfile

      // 验证年龄
      if (prefs.age !== undefined && prefs.age !== null) {
        if (typeof prefs.age !== 'number' || prefs.age < 1 || prefs.age > 120) {
          return NextResponse.json({ error: '年龄必须在 1-120 之间' }, { status: 400 })
        }
      }

      // 验证城市长度
      if (prefs.city && prefs.city.length > 50) {
        return NextResponse.json({ error: '居住城市不能超过 50 个字符' }, { status: 400 })
      }

      // 验证个人喜好长度
      if (prefs.personalInterests && prefs.personalInterests.length > 2000) {
        return NextResponse.json({ error: '个人喜好不能超过 2000 个字符' }, { status: 400 })
      }

      // 验证性别
      if (prefs.gender && !['male', 'female', 'other'].includes(prefs.gender)) {
        return NextResponse.json({ error: '性别值无效' }, { status: 400 })
      }
    }

    // 验证全名长度
    if (fullName && fullName.length > 100) {
      return NextResponse.json({ error: '姓名不能超过 100 个字符' }, { status: 400 })
    }

    // 构建更新数据
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (travelPreferences !== undefined) {
      updateData.travel_preferences = travelPreferences
    }

    if (fullName !== undefined) {
      updateData.full_name = fullName
    }

    if (avatarUrl !== undefined) {
      updateData.avatar_url = avatarUrl
    }

    // 使用 upsert 更新或插入数据库
    // 构建完整的 upsert 数据（包含必需字段）
    const upsertData: any = {
      id: user.id,
      email: user.email || '',
      updated_at: new Date().toISOString(),
      ...updateData
    }

    // 如果是首次创建，添加 created_at
    if (!updateData.full_name && !updateData.avatar_url && !updateData.travel_preferences) {
      upsertData.created_at = new Date().toISOString()
    }

    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .upsert(upsertData, {
        onConflict: 'id',
        ignoreDuplicates: false
      })
      .select('id, email, full_name, avatar_url, travel_preferences, updated_at')
      .single()

    if (updateError) {
      console.error('[API Profile PUT] Error updating profile:', updateError)
      return NextResponse.json({ error: '更新用户信息失败' }, { status: 500 })
    }

    if (!updatedProfile) {
      return NextResponse.json({ error: '更新后无法获取用户信息' }, { status: 500 })
    }

    console.log('[API Profile PUT] Profile updated successfully for user:', user.id)

    return NextResponse.json({
      success: true,
      profile: {
        id: updatedProfile.id,
        email: updatedProfile.email,
        fullName: updatedProfile.full_name,
        avatarUrl: updatedProfile.avatar_url,
        travelPreferences: updatedProfile.travel_preferences || {},
        updatedAt: updatedProfile.updated_at
      }
    })

  } catch (error: any) {
    console.error('[API Profile PUT] Unexpected error:', error)
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 })
  }
}
