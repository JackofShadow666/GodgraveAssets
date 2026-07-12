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
' 83788,43
' 84572,1
' 86365,09
' 390,335
' 9807,032
' 11663,06
' 16586,51
' 38426,39
' 39018,09
' 80969,55
' 81023,15
' 81058,27
' 81086,74
' 81088,03
' 81366,77
' 82458,07
' 82508,58
' 83070,03
' 4527,966
' 67590,83
' 74179,05
' 60225,57
' 60313,79
' 85851,56
' 85931,36
' 86330,9
' 536,419
' 945,46
' 1000,319
' 1289,8
' 2222,44
' 7545,065
