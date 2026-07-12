Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\Users\gjgut\codingprojects\THESYSTEM"
WScript.Quit shell.Run("cmd /c npm start >> logs\autostart.log 2>&1", 0, True)
