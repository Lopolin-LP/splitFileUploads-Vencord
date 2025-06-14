# Development notes
## `git diff` for patching on Windows Powershell
Windows likes to be special, and we don't want everything to be diff'd. So we run:
```powershell
(git diff -U6 src/main/csp/index.ts) -join "`n" | Out-String | New-Item -Force -Path patch.diff
```

## Resources
- https://gist.github.com/sunnniee/28bd595f8c07992f6d03289911289ba8

## Name suggestion for official CSP/CORS Api
- OfCORSCSP
  - Offcourse CSP
  - Of course, CSP!

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

## fixcors/electron.ts
Contains the CORS patch for electron (Discord Desktop & Vesktop)
