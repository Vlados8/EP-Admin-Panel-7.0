Write-Host "=============================================" -ForegroundColor Green
Write-Host "   Запуск EAS Build для iOS (Реальный iPhone)" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Переход в корневую директорию мобильного приложения
cd "$PSScriptRoot\.."

# Запуск сборки
npx eas-cli build -p ios --profile production
