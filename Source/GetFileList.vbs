Option Explicit

Dim fso, scriptFolder, reportFile, txtStream

Set fso = CreateObject("Scripting.FileSystemObject")

' Получаем путь к папке, в которой лежит сам скрипт
scriptFolder = fso.GetParentFolderName(WScript.ScriptFullName)

' Путь к финальному текстовому файлу
reportFile = fso.BuildPath(scriptFolder, "file_list.txt")

' Создаем или перезаписываем текстовый файл (True - разрешить перезапись, UTF-8/Unicode выключен)
Set txtStream = fso.CreateTextFile(reportFile, True, False)

' Запускаем рекурсивный обход папок
ScanFolder scriptFolder

' Закрываем файл и очищаем память
txtStream.Close
Set txtStream = Nothing
Set fso = Nothing

MsgBox "Список файлов успешно создан в файле file_list.txt!", vbInformation, "Готово"

' Процедура для рекурсивного сканирования папок
Sub ScanFolder(folderPath)
    Dim currentFolder, subFolder, file
    
    ' Получаем объект текущей папки
    Set currentFolder = fso.GetFolder(folderPath)
    
    ' Записываем пути всех файлов в текущей папке
    For Each file In currentFolder.Files
        ' Пропускаем сам файл отчета и файл скрипта, чтобы они не попадали в список
        If file.Path <> reportFile And file.Path <> WScript.ScriptFullName Then
            txtStream.WriteLine file.Path
        End If
    Next
    
    ' Рекурсивно заходим в каждую подпапку
    For Each subFolder In currentFolder.SubFolders
        ScanFolder subFolder.Path
    Next
End Sub
