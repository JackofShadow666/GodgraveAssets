@echo off
echo =========================================
echo OCHISTKA ISTORII GITHUB v 1 COMMIT...
echo =========================================

:: 1. Создаем чистую ветку
git checkout --orphan latest_branch

:: 2. Добавляем все файлы
git add -A

:: 3. Делаем коммит
git commit -am "Initial commit"

:: 4. Автоматически определяем имя главной ветки (main или master)
for /f "tokens=5" %%i in ('git remote show origin ^| findstr "HEAD branch"') do set DEFAULT_BRANCH=%%i

:: 5. Удаляем старую ветку локально
git branch -D %DEFAULT_BRANCH%

:: 6. Переименовываем чистую ветку
git branch -m %DEFAULT_BRANCH%

:: 7. Пушим на GitHub
git push origin %DEFAULT_BRANCH% --force

echo =========================================
echo USPESHNO! Istoriya ochishena.
echo =========================================
pause
