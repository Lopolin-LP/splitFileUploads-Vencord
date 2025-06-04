# SplitFileUploads
Allows you to upload any file(s) by optimizing size and splitting the file as much as possible.
**Warning: Extra installation steps required!**

<!-- I know there's now preview. It's AV1 encoded, not h264. -->
[Showcase](https://files.catbox.moe/eoxpq2.mp4)

### Techniques
1. If there's multiple files, put them into a `.tar` Archive.
2. Then compress using `.gz` (disabled by default).
3. Finally, split the files into `.001` and so on files, if needed.

### Limitations:
- The receiver either needs this plugin as well, or at least a tool to merge and decompress the files, such as 7-zip.
- If someone changes the file extensions around, there will be issues, as this doesn't do any fancy file type detection.
- Downloading does not work on Userscripts as I didn't find a way apply [my cors patch](#what-it-does). If you know how, feel free to open a Pull Request, your help is appreciated.

## What if [...] doesn't have the plugin? / The received archive is a bit weird?
Fear not! Tools like [7-zip](https://www.7-zip.org/) help out in this case! They got all the features this plugin utilizes.

## Installation
<!-- 1. Download this repo into `src/userplugins/splitFileUploads`
2. Naviate to that folder
3. `pnpm init`
4. `pnpm add nanotar`
5. Go back to the root of Vencord's Source Code
6. run `git apply --ignore-whitespace .\src\userplugins\splitFileUploads\fixcors.diff` or `git apply --ignore-whitespace src/userplugins/splitFileUploads/fixcors.diff`
7. Rebuild and reinject Vencord and you're done!
8. Now go and read how to [use this plugin](#Usage), as it _can_ be advanced! -->
1. Download this repo into `src/userplugins/splitFileUploads-Vencord`
2. Add this line to `pnpm-workspace.yaml` under packages: `- src/userplugins/splitFileUploads-Vencord`
   - We need to do this so that this plugin is recognized as an installable package
3. Naviate to that folder
4. run `pnpm i`
   - **WARNING: this applies a patch to Vencords Source Code!** Read [below](#why-does-this-need-to-apply-a-patch-with-git) why.
5. Rebuild and reinject Vencord and you're done!
6. Now go and read how to [use this plugin](#Usage), as it _can_ be advanced!

### Why does this need to apply a patch with git?
Downloading the files off of discords servers. `https://cdn.discordapp.com/attachments/*` does not include the `Access-Control-Allow-Origin` and `Access-Control-Allow-Methods` headers, which means the (very reasonable) CORS Policy _from Discord themselves_ blocks the connection. This patch file includes additional fixes **that need to be applied in Vencords source code directly** to rewrite the headers to include them. Vencord already does rewrites for a few sites, such as `https://raw.githubusercontent.com/`.

You may ask yourself "wait, why do I see images that were sent as attachments then?!", and the answer is _check the raw data of that message_. You will see all attachments have a URL (to the raw content that can be downloaded), and a Proxy URL, where discord includes those headers, but only for a few specific file types, such as images, videos and text files. The images are loaded from the proxy. The `.001` or `.gz` files aren't detected as text files, and thus are not accessible via their proxy. Unfunnily enough, this also applies to some Videos or Audio files if they are encoded in a format that Discord doesn't understand, such as (the very good) AV1 or (the horrible) AAC.

Read more about the [patch itself below](#the-patch).

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

## The patch
Now here's the details about the `fixcors.diff` itself, for transparency:

### The files
  - in the `browser` directory we patch the Vencord Browser Extension.
    - `background.js` and `mainfest.json` for Manifest V3.
    - `modifyResponseHeaders.json` and `mainfestv2.json` for Manifest V2.
    - the manifests ask for permission to modify content from `https://cdn.discordapp.com/attachments/`, while the other file is for actually rewriting the requests coming from discords cdn.
  - we also need to patch for Electron (to support Discords Clients and Vesktop). This happens in `src/main/index.ts`.

### What it does
Anything that starts with `https://cdn.discordapp.com/attachments/` will get the following Response Headers (i.e. the Headers received from Discords Servers) rewritten:
- `Access-Control-Allow-Origin` set to `*` to allow all origins (this means that `discord.com` is allowed to access the files coming from `cdn.discordapp.com`)
- `Access-Control-Allow-Methods` set to `GET, POST, OPTIONS` to allow different methods of accessing the content from that page. (Search online to learn more.)

## Dependencies on npm
- [fflate](https://www.npmjs.com/package/fflate) for (de)compressing.
  - Already included in Vencord.
- [nanotar](https://www.npmjs.com/package/nanotar) for bundling multiple files together.
  - Windows 11 Explorer supports tar by default, otherwise just use [7-zip](https://www.7-zip.org/), or whatever your linux distro has.

## Credits
- Icons by [Tabler Icons](https://tabler.io/icons)
- All the amazing developers of all the plugins in vencord from whom I "inspired" some code
