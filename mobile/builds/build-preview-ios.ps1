Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Запуск EAS Build для iOS (Симулятор)    " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Переход в корневую директорию мобильного приложения
cd "$PSScriptRoot\.."

# Запуск сборки
eas build -p ios --profile preview
