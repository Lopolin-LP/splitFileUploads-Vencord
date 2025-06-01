/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { waitFor } from "@webpack";
import { decompressSync, gzipSync } from "fflate";
import * as ntar from "nanotar";


// ChatGPT'd solution if all fails - keeping as a reminder for the hell that this plugin was to make
// let Archive: typeof import("libarchive.js").Archive;
// let ArchiveCompression: typeof import("libarchive.js").ArchiveCompression;
// let ArchiveFormat: typeof import("libarchive.js").ArchiveFormat;
// let isLibarchiveAvailable_resolver: () => void = () => undefined;
// const isLibarchiveAvailable = (() => {
//     return new Promise(resolve => isLibarchiveAvailable_resolver = () => { resolve(undefined); });
// })();
// try {
//     setTimeout(async () => {
//         // @ts-ignore I know my shit, this IS available once the plugin starts.
//         const libarchive = await import("https://cdn.jsdelivr.net/npm/libarchive.js@2.0.2/dist/libarchive.js").catch(() => { throw Error("Didn't fucking find it!"); }) as unknown as typeof import("libarchive.js");
//         ({ Archive, ArchiveCompression, ArchiveFormat } = libarchive);
//         console.log(libarchive, Archive, ArchiveCompression, ArchiveFormat);
//         isLibarchiveAvailable_resolver();
//     }, 5000);
// } catch (e) {
//     console.error(e);
// }

/**
 * Turns an amount of bytes into a human readable string (1024 -> "1.0 KB").
 * @param num Amount of bytes
 * @param depth Which level of conversion is already reached. If the input is in MB instead of B, you set the depth to 2.
 * @returns A human readable string
 */
export function bytesToText(num: number, depth: number = 0): string { // Grabbed from justified-gallery-viewer, my personal project
    for (; String(Math.round(num)).length > 3 && depth < 5; depth++) {
        num /= 1024;
    }
    let append = " ";
    switch (depth) {
        case 0:
            append += "B";
            break;
        case 1:
            append += "KB";
            break;
        case 2:
            append += "MB";
            break;
        case 3:
            append += "GB";
            break;
        case 4:
            append += "TB";
            break;
        default:
            append += "PB"; // I think we're beyond reason now
            break;
    }
    return num.toFixed(1) + append;
}

/**
 * Turn a number into a proper file extension. Used when splitting files.
 * 1 -> "001"
 * 2 -> "002"
 * 11 -> "011"
 * @param number The number
 * @returns A formatted string for the extension.
 */
export function turnToThree(number) {
    const arr = number.toString().split("");
    switch (arr.length) {
        case 1:
            arr.unshift("0");
            arr.unshift("0");
            break;
        case 2:
            arr.unshift("0");
            break;

        default:
            break;
    }
    return arr.join("");
}

// My own implementation corrupted lmao --- NVM I was just dumb with how the compress function, oh well
// https://github.com/101arrowz/fflate/blob/f7873560ad229c22c4b23b06c6a3806ffde77569/demo/components/code-box/sandbox.ts#L92
/**
 * Turns a File into an array of 8-bit unsigned integers - MDN. A reverse function is not needed, as you can easily create a File out of a Uint8Array.
 * @param file The input File
 * @returns the files content as a Uint8Array
 */
export async function fileToU8(file: File): Promise<Uint8Array<ArrayBuffer>> {
    let resolve: (val: Uint8Array<ArrayBuffer>) => void;
    const prom = new Promise((res: typeof resolve) => resolve = res);
    const fr = new FileReader();
    fr.onloadend = () => {
        resolve(new Uint8Array(fr.result as ArrayBuffer));
    };
    fr.readAsArrayBuffer(file);
    return prom;
}

/**
 * Turns a File into a File. Useful for changing the filename or other things without the overhead.
 * @param content The files content. Can be for example another File or a Uint8Array.
 * @param blueprint Use another File as a "blueprint", i.e. their name and attributes, but not their content.
 * @param attr Change a thing or two around, like the filename for example.
 * @returns Another File
 */
export function fileToFile(content: BlobPart[] | undefined, blueprint: File | undefined, attr?: { name?: string, type?: string, lastModified?: number; }) {
    /* output a new File copying all data from the original, except when you don't */
    blueprint ??= new File([], "");
    if (attr) {
        return new File(content ?? [blueprint], attr?.name ?? blueprint.name, { lastModified: attr?.lastModified ?? blueprint.lastModified, type: attr?.type ?? blueprint.type });
    } else {
        return new File(content ?? [blueprint], blueprint.name, { lastModified: blueprint.lastModified, type: blueprint.type });
    }
}

/**
 * CoolFile.zip -> [CoolFile, zip]
 * @param filename The filename
 * @returns An array consisting of the file name and their extension, but seperated
 */
export function seperateFileExtensionUnsafe(filename: string): [string, string] {
    const all = filename.split(".");
    return [all.slice(0, -1).join("."), all.pop() ?? ""];
}

/**
 * CoolFile.zip -> CoolFile
 * @param filename The filename
 * @returns The filename as a string, without extension
 */
export function removeFileExtensionUnsafe(filename: string) {
    // Unsafe because it's not perfect, at all.
    return filename.split(".").slice(0, -1).join(".");
}

/**
 * Compress an input File using GZIP
 * @param input The File to compress
 * @returns Another File, but with its contents gzipped. Filename stays unchanged.
 */
export async function compressFile(input: File): Promise<File> {
    // let resolveToFinish: (value: File) => void;
    // const waitForFinish = new Promise((resolve: (value: File) => void) => {
    //     resolveToFinish = resolve;
    // });
    // garch sounds funny, it means gzip archive, but the ch is pronounced different in both cases
    const garch = gzipSync(await fileToU8(input), { filename: input.name, level: 9, mem: 8 });
    return fileToFile([garch.buffer as ArrayBuffer], input);
}
/**
 * Decompress an Input File, using whatever fflate detects.
 * @param input The File to decompress
 * @returns The File, but decompressed. Filename stays unchanged.
 */
export async function decompressFile(input: File): Promise<File> {
    const ungarch = decompressSync(await fileToU8(input));
    return fileToFile([ungarch.buffer as ArrayBuffer], input);
}
/**
 * Split a File into multiple parts.
 * @param file The File to split
 * @param maxsizebytes How big each part is at max allowed to be
 * @returns An array of Files, each split correctly. All Files receive the """turnToThree""" extension.
 */
export function splitFiles(file: File, maxsizebytes: number): File[] {
    const outfiles: File[] = [];
    const splitAfter = maxsizebytes; // 10 MB
    const totalSplits = Math.ceil(file.size / splitAfter);
    if (totalSplits === 0) return [file];
    for (let i = 0; i < totalSplits - 1; i++) {
        outfiles.push(new File([file.slice(i * splitAfter, (i + 1) * splitAfter)], file.name + "." + turnToThree(i + 1)));
    }
    outfiles.push(new File([file.slice((totalSplits - 1) * splitAfter, file.size)], file.name + "." + turnToThree(totalSplits)));
    return outfiles;
}
/**
 * Recombine multiple Files.
 * @param files The Files to recombine
 * @param outputBlueprint The File to take the attributes from. If left undefined, it will use the first File found in the files parameter.
 * @returns Returns the Combined File
 */
export function unsplitFiles(files: File[], outputBlueprint: File | undefined): File {
    // We expect files to be sorted
    return fileToFile(files, outputBlueprint ?? files[0]);
}
/**
 * Check if the file extension is one from a split file, such as 001 or 002
 * @param filename The filename with extension to check
 * @returns true if it's valid, otherwise false
 */
export function isValidSplitFile(filename: string) {
    const ext = seperateFileExtensionUnsafe(filename)[1];
    if (ext.length !== 3) return false;
    const extArr = ext.split("").map(ext => parseInt(ext)).map(ext => !isNaN(ext));
    return extArr.reduce((p, c) => Boolean(Number(p) & Number(c)), true);
}
/**
 * Sorts an array of files based on split file extension. No other extensions supported.
 * @param files An array of Files to sort
 * @returns A sorted array
 */
export function sortSplitFiles(files: File[]): File[] {
    function tryNum(input: string): number {
        const ret = parseInt(input);
        return Number.isNaN(ret) ? -1 : ret;
    }
    // Code logic: Turn extension to number, if it cannot be turned to number, set it to -1 and filter it out.
    const mappedFiles: [number, File][] = files.map(file => ([tryNum(seperateFileExtensionUnsafe(file.name)[1]), file]));
    const sortedFiles = mappedFiles.filter(mapped => mapped[0] !== -1).sort((a, b) => (a[0] - b[0]));
    return sortedFiles.map(sorted => sorted[1]);
}

/**
 * Create a Tar archive using a few files. This is a simple wrapper around nanotar, because we don't need all the advanced features like directories and more.
 * @param files The files to bundle
 * @param archiveBlueprint Blueprint for the output tar file
 * @returns The final tar archive
 */
export async function createTar(files: File[], archiveBlueprint: File): Promise<File> {
    const mappedFiles: ntar.TarFileInput[] = await Promise.all(files.map(async (file: File) => {
        return {
            name: file.name,
            data: await file.arrayBuffer(),
        };
    }));
    const data: BlobPart = ntar.createTar(mappedFiles, { attrs: {} }).buffer as ArrayBuffer;
    return fileToFile([data], archiveBlueprint, { type: "application/tar" });
}

/**
 * Open a given tar archive. If it's not a valid archive, it will **fail silently** and produce garbage data.
 * @param file The tar file
 * @param opts If we should parse the files and/or directories
 * @returns An object with parsed Files, Directories and unparsable things.
 */
export async function openTar(file: File, opts?: { parseFiles?: boolean, parseDirectories?: boolean; } | undefined): Promise<{ parsedFiles: File[], knownDirectories: string[], unparsable: number; }> {
    // Returns PrasedTarFileItems, top-level Files and top-level Folders
    opts = Object.assign({ parseFiles: true, parseDirectories: true }, opts);
    const data = ntar.parseTar(await file.arrayBuffer() as ArrayBuffer);
    const parsableFiles: File[] = [];
    const knownDirectories: string[] = [];
    let unparsableFiles = 0;
    data.forEach(item => {
        if (opts.parseFiles && item.type === "file") {
            parsableFiles.push(new File([new Uint8Array(item.data ?? new ArrayBuffer()).buffer as ArrayBuffer], item.name, { lastModified: item.attrs?.mtime }));
            // item.data.buffer links to the wrong buffer! However item.data doesn't
        } else if (opts.parseDirectories && item.type === "directory") {
            knownDirectories.push(item.name);
        } else if (typeof item.type === "number") {
            unparsableFiles++;
        }
    });
    return {
        parsedFiles: parsableFiles,
        knownDirectories: knownDirectories,
        unparsable: unparsableFiles
    };
}
/**
 * Turn a nanotar file entry into a File. Currently unused.
 * @param input a nanotar TarFileItem
 * @returns the extracted File
 * @deprecated
 */
export function nanotarToFile(input: ntar.TarFileItem): File | undefined { // Currently unused?
    if (input.data === undefined) return;
    return new File([input.data.buffer as ArrayBuffer], input.name, { lastModified: input.attrs?.mtime, type: "application/tar" });
}

/**
 * Construct a Split/Compressed File(s)
 */
export class FileConstructor {
    /** The current files to split/compress */
    files: File[] = [];
    /** An object used in Discord's File Upload stack that returns the max file size */
    nitroAndPayment: { getUserMaxFileSize?(): number; } = {};
    /**
     * Return the current total of bytes of the added files.
     * @returns number
     */
    getTotalSize() {
        return this.files.reduce((p, c) => p + c.size, 0);
    }
    /**
     * Figure out how often the files (in a tar archive) have to be split
     * @param options Instead of grabbing the value, do it with preset ones
     * @returns number
     */
    getTotalSplits(options: { totalsize: number | undefined, maxsize: number | undefined; } = { totalsize: undefined, maxsize: undefined }): number {
        let { totalsize, maxsize } = options;
        totalsize = totalsize ?? this.getTotalSize(); // Total size of selected files
        maxsize = maxsize ?? this.getMaxFilesize(); // Max Per file
        return Math.max(0, Math.floor((totalsize - 1) / maxsize)); // -1 because otherwise if a file is selected that is EXACTLY the upload limit it will say it requires one split
    }
    /**
     * Get the maximum Filesize each File uploaded to Discord can be
     * @returns number in bytes
     */
    getMaxFilesize(): number {
        return (this.nitroAndPayment.getUserMaxFileSize || (() => 0))(); // two functions, run second if first undefined
    }
    // async test(): Promise<void> {
    //     // taken from fflate's playground
    //     const data = ntar.createTar(
    //         [
    //             { name: "README.md", data: "# Hello World!" },
    //             { name: "test", attrs: { mode: "777", mtime: 0 } },
    //             { name: "src/index.js", data: "console.log('wow!')" },
    //         ],
    //         { attrs: { user: "js", group: "js" } },
    //     );
    //     downloadFile(new File([data.buffer as ArrayBuffer], "testfile.tar"));
    // }
    /**
     * Turn the current files into split/compressed files
     * @param options If there should be compression/splitting, and the file name
     * @returns A promise resolving to an array of File, that can be uploaded to Discord
     */
    async apply(options: { compress: boolean, split: boolean; name: string; }): Promise<File[]> {
        let tarball: File;
        if (this.files.length === 1) {
            tarball = this.files[0];
        } else {
            tarball = await createTar(this.files, new File([], options.name + ".tar")); // why is name even defined if it's deprecated?! no wonder my tarballs didn't have any name
        }
        let output: File = tarball;
        let multiOutput: File[] = [];
        if (options.compress === true) {
            const compr = await compressFile(tarball);
            output = fileToFile([compr], compr, { name: compr.name + ".gz" });
        }
        if (options.split === true) {
            const maxfilesize = this.getMaxFilesize();
            if (maxfilesize !== 0 && output.size > maxfilesize)
                multiOutput = splitFiles(output, maxfilesize);
        }
        return multiOutput.length ? multiOutput : [output]; // 0 evals to false
    }
    /**
     * Create a new instance to Construct the files. Will pull an internal Discord function first.
     */
    constructor() {
        waitFor("getUserMaxFileSize", e => this.nitroAndPayment = e);
    }
}
/**
 * Destruct Split/Compressed Files into their original pieces
 */
export class FileDestructor {
    /** The final output. Is either the `.tar` Archive or a file as-is. */
    final: File = fileToFile([], undefined); // Is either the TAR archive, the ungzipped file or the file as-is combined
    /** A promise that will be resolved once the FileDestructor is done */
    isDone: Promise<void>; // Await this before trying to do anything with it
    /** The files parsed from the input */
    parsedFiles: File[] = [];
    /** The directories that were parsed from the input. I have not implemented a way to easily access their contents, but we can still list their names. */
    knownDirectories: string[] = [];
    /** The elements found that nanotar couldn't deal with */
    unparsable: number = 0;
    /** If the `final` attribute contains a tar or not */
    isTar: boolean | undefined; // when this is true you can access an overview of all available top-level files
    /** The HTML Element to receive the Events `statusUpdate` and `statusFinished` when the status changes. */
    statusElm?: HTMLElement;
    /** The current status. It changes. */
    status: string = "";
    /**
     * Update the Status to a new one and dispatch an Event.
     * @param msg The new status
     */
    updateStatus(msg: string) {
        this.status = msg;
        if (this.statusElm) this.statusElm.dispatchEvent(new Event("statusUpdate"));
    }
    /**
     * Finish the Status reporting and dispatch an Event. There shouldn't be any other statusUpdates following this one.
     */
    finishStatus() {
        this.status = "Finished!";
        if (this.statusElm) this.statusElm.dispatchEvent(new Event("statusFinished"));
    }
    /**
     * Create a new instance to Destruct split/compressed files into their original pieces.
     * @param files The files to destruct. Starting with unsplitting, then uncompressing.
     * @param statusElm The HTML Element to receive status updates. Check `statusElm` attribute for more info.
     */
    constructor(files: File[], statusElm?: HTMLElement) {
        let promising_resolve: any; // I don't want to
        this.statusElm = statusElm;
        this.isDone = new Promise(res => promising_resolve = res);
        (async () => {
            this.updateStatus("Unsplit");
            this.final = unsplitFiles(sortSplitFiles(files), fileToFile([files[0] ?? []], undefined, { name: removeFileExtensionUnsafe(files[0].name ?? "There are no files!") }));
            // Try to decompress
            this.updateStatus("Decompress");
            const temp1fileext = seperateFileExtensionUnsafe(this.final.name)[1];
            if (temp1fileext === "gz" || temp1fileext === "zip") {
                try {
                    this.final = fileToFile([await decompressFile(this.final)], undefined, { name: removeFileExtensionUnsafe(this.final.name) });
                } catch (e) {
                    console.log(e);
                }
            }
            this.updateStatus("Tar");
            // Try to open as tar
            if (seperateFileExtensionUnsafe(this.final.name)[1] === "tar") {
                try {
                    const tar = await openTar(this.final);
                    this.parsedFiles = tar.parsedFiles;
                    this.knownDirectories = tar.knownDirectories;
                    this.unparsable = tar.unparsable;
                    this.isTar = true;
                } catch (e) {
                    console.log(e);
                    this.isTar = false;
                }
            } else {
                this.isTar = false;
            }
            promising_resolve();
            this.finishStatus();
        })();
    }
}

export default FileConstructor;
