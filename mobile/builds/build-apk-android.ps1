Write-Host "=============================================" -ForegroundColor Yellow
Write-Host "     Запуск EAS Build для Android (APK)     " -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Yellow

# Переход в корневую директорию мобильного приложения
cd "$PSScriptRoot\.."

# Запуск сборки APK
eas build -p android --profile preview
