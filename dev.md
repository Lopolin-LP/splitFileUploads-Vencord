# Development notes
## `git diff` for patching on Windows Powershell
Windows likes to be special, and we don't want everything to be diff'd. So we run:
```powershell
(git diff browser/ src/main/index.ts) -join "`n" | Out-String | New-Item -Force -Path fixcors.patch
```
