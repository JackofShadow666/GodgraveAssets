Set objShell = CreateObject("WScript.Shell")

' Запрос сообщения для коммита у пользователя
commitMessage = InputBox("Введите сообщение для коммита:", "Git Commit Helper")

' Если пользователь нажал Отмена или оставил поле пустым, выходим
If commitMessage = "" Then
    WScript.Quit
End If

' Очередь команд: добавляем файлы, комитим и пушим в ветку main (замените на master, если нужно)
' Команда /c закрывает окно консоли после выполнения. Если нужно оставить для отладки — замените на /k
cmdCommand = "cmd.exe /c git add . && git commit -m """ & commitMessage & """ && git push origin main"

' Запуск командной строки
' Параметр 1 показывает окно консоли. Замените на 0, если хотите выполнить полностью скрытно.
objShell.Run cmdCommand, 1, True

MsgBox "Изменения успешно отправлены в Git!", 64, "Готово"
