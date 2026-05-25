Write-Host "=============================================" -ForegroundColor Yellow
Write-Host "   Запуск Expo Prebuild (Локальная генерация) " -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Yellow

# Переход в корневую директорию мобильного приложения
cd "$PSScriptRoot\.."

# Локальная генерация ios и android папок
npx expo prebuild --clean
