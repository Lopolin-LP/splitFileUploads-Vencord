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

export function fileToFile(content: BlobPart[] | undefined, blueprint: File | undefined, attr?: { name?: string, type?: string, lastModified?: number; }) {
    /* output a new File copying all data from the original, except when you don't */
    blueprint ??= new File([], "");
    if (attr) {
        return new File(content ?? [blueprint], attr?.name ?? blueprint.name, { lastModified: attr?.lastModified ?? blueprint.lastModified, type: attr?.type ?? blueprint.type });
    } else {
        return new File(content ?? [blueprint], blueprint.name, { lastModified: blueprint.lastModified, type: blueprint.type });
    }
}

export function seperateFileExtensionUnsafe(filename: string): [string, string] {
    const all = filename.split(".");
    return [all.slice(0, -1).join("."), all.pop() ?? ""];
}

export function removeFileExtensionUnsafe(filename: string) {
    // Unsafe because it's not perfect, at all.
    return filename.split(".").slice(0, -1).join(".");
}

export async function compressFile(input: File): Promise<File> {
    // let resolveToFinish: (value: File) => void;
    // const waitForFinish = new Promise((resolve: (value: File) => void) => {
    //     resolveToFinish = resolve;
    // });
    // garch sounds funny, it means gzip archive, but the ch is pronounced different in both cases
    const garch = gzipSync(await fileToU8(input), { filename: input.name, level: 9, mem: 8 });
    return fileToFile([garch.buffer as ArrayBuffer], input);
}
export async function decompressFile(input: File): Promise<File> {
    const ungarch = decompressSync(await fileToU8(input));
    return fileToFile([ungarch.buffer as ArrayBuffer], input);
}
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
export function unsplitFiles(files: File[], outputBlueprint: File): File {
    // We expect files to be sorted
    return fileToFile(files, outputBlueprint ?? files[0]);
}
export function isValidSplitFile(filename: string) {
    const ext = seperateFileExtensionUnsafe(filename)[1];
    if (ext.length !== 3) return false;
    const extArr = ext.split("").map(ext => parseInt(ext)).map(ext => !isNaN(ext));
    return extArr.reduce((p, c) => Boolean(Number(p) & Number(c)), true);
}
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
export function nanotarToFile(input: ntar.TarFileItem): File | undefined { // Currently unused?
    if (input.data === undefined) return;
    return new File([input.data.buffer as ArrayBuffer], input.name, { lastModified: input.attrs?.mtime, type: "application/tar" });
}

export class FileConstructor {
    files: File[] = [];
    processed: File[] = [];
    nitroAndPayment: { getUserMaxFileSize?(): number; } = {};
    getTotalSize() {
        return this.files.reduce((p, c) => p + c.size, 0);
    }
    getTotalSplits(options: { totalsize: number | undefined, maxsize: number | undefined; } = { totalsize: undefined, maxsize: undefined }): number {
        let { totalsize, maxsize } = options;
        totalsize = totalsize ?? this.getTotalSize(); // Total size of selected files
        maxsize = maxsize ?? this.getMaxFilesize(); // Max Per file
        return Math.floor(totalsize / maxsize);
    }
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
            multiOutput = splitFiles(output, this.getMaxFilesize());
        }
        return multiOutput.length ? multiOutput : [output];
    }
    constructor() {
        waitFor("getUserMaxFileSize", e => this.nitroAndPayment = e);
    }
}
export class FileDestructor {
    final: File = fileToFile([], undefined); // Is either the TAR archive, the ungzipped file or the file as-is combined
    isDone: Promise<void>; // Await this before trying to do anything with it
    parsedFiles: File[] = [];
    knownDirectories: string[] = [];
    unparsable: number = 0;
    isTar: boolean | undefined; // when this is true you can access an overview of all available top-level files
    statusElm?: HTMLElement;
    status: string = "";
    updateStatus(msg: string) {
        this.status = msg;
        if (this.statusElm) this.statusElm.dispatchEvent(new Event("statusUpdate"));
    }
    finishStatus() {
        this.status = "Finished!";
        if (this.statusElm) this.statusElm.dispatchEvent(new Event("statusFinished"));
    }
    constructor(files: File[], statusElm?: HTMLElement) {
        let promising_resolve: any; // I don't want to
        this.statusElm = statusElm;
        this.isDone = new Promise(res => promising_resolve = res);
        (async () => {
            this.updateStatus("Unsplit");
            this.final = unsplitFiles(sortSplitFiles(files), fileToFile([files[0]], undefined, { name: removeFileExtensionUnsafe(files[0].name) }));
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
