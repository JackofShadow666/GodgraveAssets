' GodgraveLauncher.vbs — универсальный запускальщик
' Использование: перетащите папку с игрой или index.html на этот файл

Set objShell = CreateObject("Wscript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Получаем путь к папке
If WScript.Arguments.Count = 0 Then
    ' Если запустили без параметров — запрашиваем папку
    folderPath = objShell.BrowseForFolder(0, "Выберите папку с игрой Godgrave", 0, "").Items().Item().Path
    If folderPath = "" Then WScript.Quit
Else
    ' Получаем путь из аргумента
    argPath = WScript.Arguments(0)
    
    ' Если перетащили index.html — берём его папку
    If objFSO.FileExists(argPath) Then
        folderPath = objFSO.GetParentFolderName(argPath)
    ElseIf objFSO.FolderExists(argPath) Then
        folderPath = argPath
    Else
        MsgBox "Файл или папка не найдены!", 16, "Ошибка"
        WScript.Quit
    End If
End If

' Проверяем, есть ли index.html
If Not objFSO.FileExists(folderPath & "\index.html") Then
    MsgBox "В папке " & folderPath & " нет index.html!", 16, "Ошибка"
    WScript.Quit
End If

' Определяем порт (автоматически ищем свободный)
port = 8000
Do While True
    Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")
    Set colItems = objWMIService.ExecQuery("Select * From Win32_Process Where Name Like '%python%' or Name Like '%node%'")
    portOccupied = False
    For Each objItem in colItems
        commandLine = LCase(objItem.CommandLine)
        If InStr(commandLine, ":" & port) > 0 Then
            portOccupied = True
            Exit For
        End If
    Next
    If Not portOccupied Then Exit Do
    port = port + 1
Loop

' Показываем уведомление
MsgBox "🟢 Запуск Godgrave из папки:" & vbCrLf & folderPath & vbCrLf & vbCrLf & "📡 Порт: " & port & vbCrLf & "🌐 Открывается браузер...", 64, "Godgrave Launcher"

' Запускаем сервер (через Python)
Set objExec = objShell.Exec("python -m http.server " & port)
WScript.Sleep 1000

' Открываем браузер с параметром assets=./
url = "http://localhost:" & port & "/index.html?assets=./"
objShell.Run url

' Ждём нажатия Enter для остановки
objShell.Popup "🟢 Сервер запущен на порту " & port & vbCrLf & vbCrLf & "🔴 Нажмите ОК чтобы остановить сервер", 0, "Godgrave Server", 64

' Останавливаем сервер
objShell.Run "taskkill /F /IM python.exe", 0, True
MsgBox "✅ Сервер остановлен", 64, "Godgrave"