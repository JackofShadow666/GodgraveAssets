' BuildList.vbs
' Скрипт создает список файлов из папок Music и Sound (включая подпапки)
' Корневая папка со скриптом входит в путь к файлам

Option Explicit

Dim fso, logFile, rootFolder, outputPath, rootFolderName
Dim targetFolders, folderName, targetFolder

' Создаем объект файловой системы
Set fso = CreateObject("Scripting.FileSystemObject")

' Определяем папку, где находится текущий скрипт
rootFolder = fso.GetParentFolderName(WScript.ScriptFullName)
If rootFolder = "" Then rootFolder = fso.GetAbsolutePathName(".")

' Получаем имя корневой папки
rootFolderName = fso.GetFolder(rootFolder).Name

' Путь к выходному файлу
outputPath = fso.BuildPath(rootFolder, "BuildList.txt")

' Массив с именами целевых папок
targetFolders = Array("Music", "Sound", "Character", "Weapon")

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
        ' Рекурсивный обход папки с указанием корневой папки
        Call ListFilesRecursively(targetFolder, rootFolderName)
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

' Уведомление
WScript.Echo "Готово! Список сохранен в:" & vbCrLf & outputPath

' ------------------------------------------------------------
' Рекурсивная процедура для обхода папок и записи путей к файлам
' ------------------------------------------------------------
Sub ListFilesRecursively(currentFolder, currentRelativePath)
    Dim folder, subFolder, file, newRelativePath
    
    Set folder = fso.GetFolder(currentFolder)
    
    ' Формируем относительный путь от корневой папки со скриптом
    newRelativePath = currentRelativePath & "\" & folder.Name
    
    ' Перебираем все файлы в текущей папке
    For Each file In folder.Files
        logFile.WriteLine newRelativePath & "\" & file.Name
    Next
    
    ' Рекурсивно обрабатываем подпапки
    For Each subFolder In folder.SubFolders
        Call ListFilesRecursively(subFolder.Path, newRelativePath)
    Next
End Sub