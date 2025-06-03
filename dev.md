# Development notes
## `git diff` for patching on Windows Powershell
Windows likes to be special, and we don't want everything to be diff'd. So we run:
```powershell
(git diff -U6 browser/ src/main/index.ts) -join "`n" | Out-String | New-Item -Force -Path fixcors.diff
```

# Code documentation
This ain't a small project by any means, so here's a quick rundown on the most important stuff

## fileConstructor.ts
Here are all function related to the file handling. Splitting, Merging, (de)compressing, uploading, downloading, etc.

## fileWrapper.ts
Here are all functions related to glueing the UI to the magic. It updates statuses, displays the content and allows downloading and uploading.

## index.tsx
Here lies the plugin definition. It imports and applies the button used for uploading and the one downloading.

## modals.tsx
Here are all the UI Elements created by this plugin.

## ownStuff.tsx
This contains some helper functions.
