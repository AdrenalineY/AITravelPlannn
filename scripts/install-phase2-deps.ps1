# 第二阶段依赖安装脚本

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  安装第二阶段依赖包" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan

# 检查是否在项目目录
if (-not (Test-Path "package.json")) {
    Write-Host "错误: 请在项目根目录运行此脚本" -ForegroundColor Red
    exit 1
}

Write-Host "正在安装运行时依赖..." -ForegroundColor Green
npm install mapbox-gl react-map-gl dayjs

Write-Host "`n正在安装开发依赖..." -ForegroundColor Green
npm install --save-dev @types/mapbox-gl @types/mapbox__mapbox-gl-geocoder

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  依赖安装完成!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "下一步操作:" -ForegroundColor Yellow
Write-Host "  1. 配置 Mapbox Token:" -ForegroundColor White
Write-Host "     在 .env.local 中添加:" -ForegroundColor Gray
Write-Host "     NEXT_PUBLIC_MAPBOX_TOKEN=your_token`n" -ForegroundColor Cyan

Write-Host "  2. 创建数据库表:" -ForegroundColor White
Write-Host "     在 Supabase SQL Editor 中执行:" -ForegroundColor Gray
Write-Host "     supabase/migrations/02_itinerary_tables.sql`n" -ForegroundColor Cyan

Write-Host "  3. 启动开发服务器:" -ForegroundColor White
Write-Host "     npm run dev`n" -ForegroundColor Cyan

Write-Host "获取 Mapbox Token:" -ForegroundColor Yellow
Write-Host "  https://account.mapbox.com/access-tokens/`n" -ForegroundColor Cyan
