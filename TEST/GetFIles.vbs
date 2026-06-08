Option Explicit

Dim fso, currentDir, objFolder, colFiles, objFile, outputFile, txtFile

Set fso = CreateObject("Scripting.FileSystemObject")

' Исправлено: используем ScriptFullName для получения пути к файлу скрипта
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Файл со списком создастся в этой же папке
outputFile = currentDir & "\file_list.txt"

If fso.FolderExists(currentDir) Then
    Set objFolder = fso.GetFolder(currentDir)
    Set colFiles = objFolder.Files
    
    Set txtFile = fso.CreateTextFile(outputFile, True)
    
    For Each objFile in colFiles
        ' Не добавляем в список сам файл отчета и файл этого скрипта
        If objFile.Name <> "file_list.txt" And objFile.Name <> fso.GetFileName(WScript.ScriptFullName) Then
            txtFile.WriteLine(objFile.Name)
        End If
    Next
    
    txtFile.Close
    MsgBox "Список файлов текущей папки создан!", vbInformation, "Готово"
Else
    MsgBox "Не удалось определить текущую папку.", vbCritical, "Ошибка"
End If

Set txtFile = Nothing
Set colFiles = Nothing
Set objFolder = Nothing
Set fso = Nothing
