# SplitFileUploads
Allows you to upload any file(s) by optimizing size and splitting the file as much as possible.
**Warning: Extra installation steps required!**

### Techniques
1. If there's multiple files, put them into a `.tar` Archive.
2. Then compress using `.gz`.
3. Finally, split the files into `.001` and so on files, if needed.

### Limitations:
- Max. total file size is limited by how much you _can_ upload. If max. per file is 10 MB, you can only upload 100 MB.
- The receiver either needs this plugin as well, or at least a tool to merge and decompress the files, such as 7-zip.
- If any archiving tool adds headers to Split Archives, this plugin will fail COMPLETELY.

## What If [...] doesn't have the plugin? / The Archive is a bit weird?
Fear not! Tools like [7-zip](https://www.7-zip.org/) help our in this case! They got all the features this plugin utilizes.

## Installation
1. Download this repo into `userplugins/splitFileUploads`
2. Naviate to that folder
3. `pnpm init`
4. `pnpm add nanotar`
5. Reinject Vencord and you're done!

Note: Fancier version with a simple `pnpm i` will come at some point, right now I don't understand any of it!

## Dependencies on npm
- [fflate](https://www.npmjs.com/package/fflate)
- [nanotar](https://www.npmjs.com/package/nanotar)

## Credits
- Icons by [Tabler Icons](https://tabler.io/icons)
- All the amazing developers of all the plugins from whom I "inspired" some code
