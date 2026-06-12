' BuildMusicList.vbs
' Скрипт создает список файлов из папок Music и Sound (включая подпапки)

Option Explicit

Dim fso, logFile, rootFolder, outputPath
Dim targetFolders, folderName, targetFolder

' Создаем объект файловой системы
Set fso = CreateObject("Scripting.FileSystemObject")

' Определяем папку, где находится текущий скрипт
rootFolder = fso.GetParentFolderName(WScript.ScriptFullName)
If rootFolder = "" Then rootFolder = fso.GetAbsolutePathName(".")

' Путь к выходному файлу
outputPath = fso.BuildPath(rootFolder, "BuildMusicList.txt")

' Массив с именами целевых папок
targetFolders = Array("Music", "Sound")

' Открываем файл для записи (перезапись, если существует)
Set logFile = fso.CreateTextFile(outputPath, True, False)

' Заголовок отчета
logFile.WriteLine "; Список файлов из папок Music и Sound"
logFile.WriteLine "; Создано: " & Now()
logFile.WriteLine "; Корневая папка: " & rootFolder
logFile.WriteLine ""

' Перебираем каждую целевую папку
For Each folderName In targetFolders
    targetFolder = fso.BuildPath(rootFolder, folderName)
    
    If fso.FolderExists(targetFolder) Then
        logFile.WriteLine "=== Папка: " & folderName & " ==="
        ' Рекурсивный обход папки
        Call ListFilesRecursively(targetFolder, "")
        logFile.WriteLine ""
    Else
        logFile.WriteLine "=== Папка НЕ НАЙДЕНА: " & folderName & " ==="
        logFile.WriteLine ""
    End If
Next

' Закрываем файл
logFile.Close

' Освобождаем ресурсы
Set logFile = Nothing
Set fso = Nothing

' Уведомление (можно закомментировать)
WScript.Echo "Готово! Список сохранен в:" & vbCrLf & outputPath

' ------------------------------------------------------------
' Рекурсивная процедура для обхода папок и записи путей к файлам
' ------------------------------------------------------------
Sub ListFilesRecursively(currentFolder, relativePath)
    Dim folder, subFolder, file, newRelativePath
    
    Set folder = fso.GetFolder(currentFolder)
    
    ' Если relativePath пустой, то это корневая целевая папка
    If relativePath = "" Then
        newRelativePath = folder.Name
    Else
        newRelativePath = relativePath & "\" & folder.Name
    End If
    
    ' Перебираем все файлы в текущей папке
    For Each file In folder.Files
        logFile.WriteLine newRelativePath & "\" & file.Name
    Next
    
    ' Рекурсивно обрабатываем подпапки
    For Each subFolder In folder.SubFolders
        Call ListFilesRecursively(subFolder.Path, newRelativePath)
    Next
End Sub