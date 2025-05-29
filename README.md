# SplitFileUploads
Allows you to upload any file(s) by optimizing size and splitting the file as much as possible.
**Warning: Extra installation steps required!**

### Techniques
1. If there's multiple files, put them into a `.tar` Archive.
2. Then compress using `.gz`.
3. Finally, split the files into `.001` and so on files, if needed.

### Limitations:
- The receiver either needs this plugin as well, or at least a tool to merge and decompress the files, such as 7-zip.
- If someone changes the file extensions around, there will be issues, as this doesn't do any fancy file type detection.

## What If [...] doesn't have the plugin? / The Archive is a bit weird?
Fear not! Tools like [7-zip](https://www.7-zip.org/) help out in this case! They got all the features this plugin utilizes.

## Installation
1. Download this repo into `src/userplugins/splitFileUploads`
2. Naviate to that folder
3. `pnpm init`
4. `pnpm add nanotar`
5. Go back to the root of Vencord's Source Code
6. run `git apply .\src\userplugins\splitFileUploads\fixcors.patch` or `git apply src/userplugins/splitFileUploads/fixcors.patch`
7. Rebuild and reinject Vencord and you're done!
8. Now go and read how to [use this plugin](#Usage), as it _can_ be advanced!

Note: Fancier version with a simple `pnpm i` will come at some point, right now I don't understand any of it!

## Usage
### Simple Uploading/Downloading
This is the primary use. It's limited by how much you _can_ upload. As the file limit per message is 10 files, this doesn't work when there's more.

#### Uploading
1. Click on the Upload icon in the Chatbar.
2. Click attach files to select the files to upload, or drag'n'drop them on the button.
3. If you have multiple files, select a name for `.tar` archive!
4. Select how they should be processed (Split and/or Compressed, or neither).
   - Compression is disabled by default, as it's only effective for plain text files. Videos, Images, etc. are already compressed.
   - I'm also unsure why you would disable splitting.
5. Click "Compute & Attach", the files should appear in the message draft soon. If there were going to be more than 10 files, yet none attached, check the advanced section for uploading.

#### Downloading
1. If you received a message with files ending in `.001` and so on, hover over the message and click the download button.
2. The Plugin should automatically start fetching the files and downloading them.
3. Now you can select what to download, or download the entire file (it will be a `.tar` if it were multiple files).

### Advanced Uploading/Downloading
If you really want to, you can also upload more than 10 split files. For non-Nitro users this applies for files above 100 MB.

#### Uploading
1. Do as written in the simple instructions.
2. Right click the Upload icon to select which batch of files to attach to your message. You will need to manually upload each batch.
3. Once you're done, hit "Delete from Memory".

#### Downloading
1. Copy the message link of all messages containing the files you need to download.
2. Click on the Upload icon, then on "Multi-Download".
3. Insert all the links, each on their own new line, just like Online Themes!
4. Click download, the normal downloading modal should now open.

## Dependencies on npm
- [fflate](https://www.npmjs.com/package/fflate)
- [nanotar](https://www.npmjs.com/package/nanotar)

## Credits
- Icons by [Tabler Icons](https://tabler.io/icons)
- All the amazing developers of all the plugins from whom I "inspired" some code
