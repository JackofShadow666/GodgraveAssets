Set objShell = CreateObject("WScript.Shell")

' Укажите здесь путь к репозиторию, если скрипт лежит в другом месте:
' objShell.CurrentDirectory = "C:\path\to\your\project"

' Формируем команду с фиксированным сообщением коммита "up"
cmdCommand = "cmd.exe /c git add . && git commit -m ""up"" && git push origin main"

' Запуск в скрытом режиме (0) с ожиданием завершения (True)
objShell.Run cmdCommand, 0, True
