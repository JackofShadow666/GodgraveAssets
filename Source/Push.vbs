Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Исправлено: получаем полный путь к запущенному скрипту
ScriptPath = WScript.ScriptFullName

' Автоматически определяем папку, в которой лежит скрипт
CurrentDir = objFSO.GetParentFolderName(ScriptPath)
objShell.CurrentDirectory = CurrentDir

' 1. ДЕЛАЕМ СКРИПТ "КРАСНЫМ" (дописываем метку времени в конец файла)
Set objFile = objFSO.OpenTextFile(ScriptPath, 8) ' 8 = Добавление в конец
objFile.WriteLine "' " & Timer
objFile.Close

' Ждем 1 секунду, чтобы Проводник успел обновить иконку на красную
WScript.Sleep 1000

' 2. ЗАПУСКАЕМ ОСНОВНОЙ ПУШ ваших рабочих файлов
' Исключаем сам скрипт из этого коммита, чтобы он оставался красным
cmdCommand = "cmd.exe /c git add . && git reset " & objFSO.GetFileName(ScriptPath) & " && git commit -m ""up"" && git push origin main"
objShell.Run cmdCommand, 0, True

' 3. ДЕЛАЕМ СКРИПТ "ЗЕЛЁНЫМ" (коммитим только сам скрипт локально)
cmdFinal = "cmd.exe /c git add " & objFSO.GetFileName(ScriptPath) & " && git commit -m ""script status update"""
objShell.Run cmdFinal, 0, True' 31193,67
' 34146,56
' 34505,05
' 53516,52
' 54024,86
' 54291,6
' 54756,84
