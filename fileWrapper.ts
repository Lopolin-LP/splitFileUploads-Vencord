/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// type NativeFile = globalThis.File;

import { Alerts, MessageStore, SelectedChannelStore, showToast } from "@webpack/common";
import { Message, MessageAttachment } from "discord-types/general";

import { bytesToText, FileConstructor, FileDestructor, fileToFile, isValidSplitFile } from "./fileConstructor";
import { addAttachments, downloadFile, hasAttachmentPerms, notifErr } from "./ownStuff";

// Split Message Uploader
export const currentSMU: { [channelId: string]: SMU; } = {};
/**
 * Split Message Uploader
 */
export class SMU {
    fileBatches: File[][];
    channelId: string;
    attachBatch(i: number) {
        addAttachments(this.fileBatches[i], this.channelId);
    }
    getStuffForMenu() {
        return this.fileBatches.map((item, index) => ({ label: "Batch " + index, exec: () => { this.attachBatch(index); } }));
    }
    delete() {
        delete currentSMU[this.channelId];
    }
    constructor(files: File[], channelId: string) {
        this.channelId = channelId;
        this.fileBatches = new Array(Math.ceil(files.length / 10)).fill(0).map(() => []);
        for (let i = 0; i < files.length; i++) {
            this.fileBatches[Math.floor(i / 10)].push(files[i]);
        }
        currentSMU[channelId] = this;
    }
}

// Split Message Downloader
/**
 * Split Message Downloader
 */
export class SMD {
    parsedMessages: Message[];
    constructor(messageURLs: string[]) {
        // example: https://canary.discord.com/channels/1373311417536610364/1373311417536610367/1376001246502195210
        const messages: Message[] = [];
        messageURLs.forEach(discordurl => {
            try {
                const [channelId, messageId] = discordurl.split("/").slice(-2);
                messages.push(MessageStore.getMessage(channelId, messageId));
            } catch (e) {
                console.error(e);
                notifErr(`Parsing URL ${discordurl} failed, check Web Console.`);
            }
        });
        this.parsedMessages = messages;
    }
}

// Split File Uploader
type SFU_settings = { compress: boolean, split: boolean; name: string; };
type SFU_react_settings = { [K in keyof SFU_settings]: [SFU_settings[keyof SFU_settings], Function] };
/**
 * Split File Uploader
 */
export class SFU {
    /** The default settings used for the FileConstructor */
    public default_settings: SFU_settings = {
        compress: false,
        split: true,
        name: "Unknown"
    };
    /** The channel id in which this is happening */
    channelId: string;
    /** The custom HTML ELement in React, used for displaying some informations */
    elm: HTMLElement | null = null;
    /** The corresponding FileConstructor */
    fileconst: FileConstructor;
    /** The Key of the React Modal */
    modalKey: string = "";
    /** The HTML table containing the current files */
    table: HTMLElement | null = null;
    /**
     * Start the FileConstructor process
     * @param settings The settings for FileConstructor
     * @returns true if the setup was successful. False if there aren't any files. Nothing if something went wrong.
     */
    async start(settings: SFU_settings) {
        if (this.fileconst.files.length === 0) return false;
        showToast("Starting SFU", "message", { duration: 1000 });
        // Check Perms
        if (!hasAttachmentPerms(this.channelId)) {
            Alerts.show({
                title: "Hold on!",
                body: "You don't have any Attachment Permissions here! Navigate to a channel where you do have Permission."
            });
            return;
        }
        // Start Computation
        const files = await this.fileconst.apply(settings);

        // Attach Files
        (async () => {
            if (files.length <= 10) {
                addAttachments(files, this.channelId);
                showToast("Finished SFU, you may now send your message.", "success", { duration: 3000 });
            } else {
                new SMU(files, this.channelId);
                showToast("Finished SFU, there were more than 10 files. Right-click the Upload button to attach one by one.", "success", { duration: 10000 });
            }
        })();
        return true;
    }
    /**
     * Add new files to the FileConstructor
     * @param list a FileList, commonly received from input events
     */
    addFiles(list: FileList) {
        if (this.elm === null) return notifErr("Table element isn't defined.");
        // Add Files to UI + Attribute
        const close = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M20 6a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-11l-5 -5a1.5 1.5 0 0 1 0 -2l5 -5z" />
            <path d="M12 10l4 4m0 -4l-4 4" />
        </svg>`;
        function findParentWithTRTag(elm: HTMLElement | null) {
            for (let i = 0; (elm?.tagName !== "TR" && elm !== null) && i < 7; i++) {
                elm = elm?.parentElement ?? null;
            }
            return elm;
        }
        Array.from(list).forEach((file: File) => {
            this.fileconst.files.push(file);
            const entry = document.createElement("tr");
            entry.innerHTML = "<tr><td>" + file.name + "</td><td><button>" + close + "</button></td></tr>";
            entry.querySelector("button")?.addEventListener("click", e => {
                // @ts-ignore: if() check 10 lines above already takes care of this
                this.removeFile(Array.from(this.table.children).indexOf(findParentWithTRTag(e.target as HTMLElement)));
            });
            // @ts-ignore: if() check 15 lines above already takes care of this
            this.table.append(entry);
        });
        // TODO: Add more stats to the file list!
        this.updateFileSizes();
    }
    /**
     * Removes a file from the FileConstructor
     * @param index the how manyth file in the array it is
     */
    removeFile(index: number) {
        if (index === -1 || this.fileconst.files.length < index) return notifErr("Invalid Index for removal.");
        if (this.elm === null) return notifErr("Table element isn't defined.");
        const elmToYeet = this.table?.querySelector("tr:nth-child(" + (index + 1) + ")");
        if (elmToYeet) {
            elmToYeet.remove();
            this.fileconst.files.splice(index, 1);
        }
        this.updateFileSizes();
    }
    /**
     * Sets the custom HTML Element in the React Modal. Can only be done once.
     * @param elm The Element
     */
    setElm(elm: HTMLElement) {
        if (this.elm !== null) return; // Fail silently, this is due to Reacts Renderer
        if (elm === null) return notifErr("setElm elm was null!");
        if (!elm.classList.contains("splitFileUploadModal")) return;
        this.elm = elm;
        this.table = elm.querySelector("table");
    }
    /**
     * Update the infographic showing the max file size, the current total and so on.
     */
    updateFileSizes() {
        try {
            [
                [".maxSingleFileSize", bytesToText(this.fileconst.getMaxFilesize())],
                [".currentTotalFileSize", bytesToText(this.fileconst.getTotalSize())],
                [".currentRequiredSplits", this.fileconst.getTotalSplits().toFixed(0)]
            ].forEach(item => {
                (this.elm?.querySelector(item[0]) as HTMLElement ?? {}).innerText = item[1];
            });
        } catch (e) {
            if (e instanceof TypeError) return console.info(e);
            console.error(e);
        }
    }
    /**
     * Create new SFU instance
     */
    constructor() {
        this.fileconst = new FileConstructor();
        this.channelId = SelectedChannelStore.getChannelId();
    }
    /**
     * Run once the HTML Elements are available
     */
    postConstructor() {
        this.updateFileSizes();
    }
}

// Split File Downloader
/**
 * Each attachment has a unique ID. If we downloaded a File from discords servers, we cache them.
 */
const discordFilesCache: { [key: string]: File; } = {};

/**
 * Removes all Downloaded files from Cache. Hopefully frees up memory.
 */
export function clearDiscordFilesCache() {
    Object.keys(discordFilesCache).forEach(key => delete discordFilesCache[key]);
}

/**
 * Split File Destructor Status - An internal class for the SFD class. It's used to update the status of the download process.
 */
class SFDstatus {
    /** All statuses will be in here */
    parent: HTMLElement;
    /** the different statuses with their corresponsing HTML Elements, prefix and setStatus function */
    statuses: { elm: HTMLElement; prefix: string | undefined; setStatus: (msg: string) => void; }[] = [];
    /**
     * Add a new status that can be updated.
     * @param prefix The prefix to use for this status. Used to distinguish it from others
     * @returns an object with  the element, the prefix and the function to update the status.
     */
    addStatus(prefix?: string) {
        const elm = document.createElement("div");
        this.parent.appendChild(elm);
        let setStatus: (msg: string) => void;
        if (prefix) {
            setStatus = (msg: string) => {
                elm.innerText = prefix + msg;
            };
        } else {
            setStatus = (msg: string) => {
                elm.innerText = msg;
            };
        }
        const out = { elm: elm, prefix: prefix, setStatus: setStatus };
        this.statuses.push(out);
        return out;
    }
    /**
     * Create a new SFDstatus instance.
     * @param statusElmToUse The status Element to use
     */
    constructor(statusElmToUse: HTMLElement) {
        this.parent = document.createElement("div");
        this.parent.classList.add("splitFileUploadMultiStatus");
        statusElmToUse.appendChild(this.parent);
    }
}

/**
 * Split File Destructor. Requires one or more messages.
 */
export class SFD {
    /** The corresponding FileDestructor instance */
    filedest: FileDestructor | undefined;
    /** If the FileDestructor is finished */
    isDone: Promise<void>; // Is done AFTER filedest.isDone
    /** The Custom HTML Element in the React Modal */
    elm: HTMLElement | null = null;
    /** The Table in the React Modal containing the parsed files */
    table: HTMLElement | null = null;
    /** If the Element was added yet */
    isElm: Promise<void>;
    /** Resolve the isElm Promise */
    // @ts-ignore that's a lie
    isElmResolver: () => void;
    /** The Key of the React Modal */
    modalKey: string = "";
    /** The status Element containing the progress of downloading files and the FileDestructor */
    statusElm: HTMLElement;
    /**
     * Downloads attachments from Discord's Server. Make sure you applies some CORS fixes!
     * @param attachments The Attachments to get
     * @returns A promise that resolves to an array of downloaded Files
     */
    downloadDiscordFiles(attachments: MessageAttachment[]): Promise<File[]> {
        const statusManager = new SFDstatus(this.statusElm);
        return Promise.all(attachments.filter(attach => isValidSplitFile(attach.filename)).map(async attach => {
            let promising: Promise<File>;
            const { filename } = attach;
            const status = statusManager.addStatus(filename + ": ");
            status.setStatus("Downloading file");
            if (discordFilesCache[attach.id]) {
                // Grab it from cache, not to burden discords servers!
                promising = new Promise(res => {
                    status.setStatus("Received from cache!");
                    res(discordFilesCache[attach.id]);
                });
            } else {
                // otherwise get it from the server.
                let promising_resolver: (file: File) => void;
                promising = new Promise(res => promising_resolver = res);
                const xhr = new XMLHttpRequest();
                xhr.open("GET", attach.url);
                xhr.responseType = "blob";
                xhr.onload = function () {
                    if (xhr.status === 200) {
                        const outfile = new File([xhr.response], filename);
                        status.setStatus("Downloaded!");
                        promising_resolver(outfile);
                        discordFilesCache[attach.id] = outfile; // Cache it
                    } else {
                        console.error("Failed download!", xhr.status, xhr.response, xhr);
                        status.setStatus(`Failed download! HTTP Code was ${xhr.status}.`);
                        promising_resolver(fileToFile([], undefined));
                    }
                };
                xhr.onerror = function (e) {
                    console.error("There was an error", e, xhr);
                    status.setStatus("Failed download! Check the console.");
                };
                xhr.send();
            }
            return promising;
        }));
    }
    /**
     * Set the HTML Element
     * @param elm The Element
     */
    setElm(elm: HTMLElement) {
        if (this.elm !== null) return; // Fail silently, this is due to Reacts Renderer
        if (elm === null) return notifErr("setElm elm was null!");
        if (!elm.classList.contains("splitFileUploadModal")) return;
        this.elm = elm;
        this.table = elm.querySelector("table");
        this.elm.querySelector(".splitFileUploadStatus")?.append(this.statusElm);
        this.isElmResolver();
    }
    /**
     * Add a new Element to the downloaded files table
     * @param name The filename
     * @param download An object only there when it can be downloaded. Index will be passed to downloadSpecificFile.
     */
    async addElm(name: string, download?: { index: number; }) {
        await this.isElm;
        const entry = document.createElement("tr");

        const content = document.createElement("td");
        content.innerText = name;
        const icon = document.createElement("td");
        if (download) {
            icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
                <path d="M7 11l5 5l5 -5" />
                <path d="M12 4l0 12" />
            </svg>`;
            icon.addEventListener("click", () => {
                this.downloadSpecificFile(download.index);
            });
        }
        entry.append(content, icon);
        // @ts-ignore we are waiting for it to be there
        this.table.append(entry);
    }
    /** Download all parsed files. Downloads the final File found in FileDestructor, which is either a Tar or just the raw file. */
    downloadAll() {
        if (this.filedest?.final) downloadFile(this.filedest.final);
    }
    /**
     * Download a specific parsed file from the parsedFiles attribute in FileDestructor.
     * @param index The index of it.
     */
    downloadSpecificFile(index: number) {
        const file = this.filedest?.parsedFiles[index];
        if (file) downloadFile(file);
    }
    /**
     * List all files after the FileDestructor is done doing its thing.
     */
    async listFiles() {
        await Promise.all([this.isDone, this.isElm]);
        if (this.filedest?.isTar === false) {
            this.addElm(this.filedest.final.name + " is downloadable!");
            (this.elm?.querySelector(".sfuInfo")?.parentElement?.parentElement as HTMLElement).remove();
        } else {
            this.filedest?.knownDirectories.forEach(item => {
                this.addElm(item);
            });
            this.filedest?.parsedFiles.forEach((item, index) => {
                this.addElm(item.name, { index: index });
            });
            const textUnparsable = (): string => { if (this.filedest?.unparsable) return `There were ${this.filedest?.unparsable} unparsable entities.`; else return ""; };
            const sfuInfo = this.elm?.querySelector(".sfuInfo") as HTMLElement;
            function addInfo(msg: string) {
                if (msg === "") return;
                const elm = document.createElement("div");
                elm.innerText = msg;
                sfuInfo.appendChild(elm);
            }
            addInfo(this.filedest?.knownDirectories.length ? "Entries without download button are directories." : "");
            addInfo(textUnparsable());
        }
    }
    /**
     * Create a new instance of SFD.
     * @param message The message(s) to use.
     */
    constructor(message: Message | Message[]) {
        let promising_resolver;
        this.isDone = new Promise(res => promising_resolver = res);
        this.isElm = new Promise(res => this.isElmResolver = res);
        this.statusElm = document.createElement("div");
        this.statusElm.addEventListener("statusUpdate", () => {
            if (this.filedest?.status) this.statusElm.innerText = this.filedest?.status;
        });
        this.statusElm.addEventListener("statusFinished", () => {
            if (this.filedest?.status) this.statusElm.innerText = this.filedest?.status;
            setTimeout(() => {
                this.statusElm.remove();
            }, 750);
        });
        const msgAttachments: MessageAttachment[] = [];
        if (message instanceof Array) {
            message.forEach(item => msgAttachments.push(...item.attachments));
        } else {
            msgAttachments.push(...message.attachments);
        }
        (async () => {
            // @ts-expect-error bruh.
            this.filedest = new FileDestructor(await this.downloadDiscordFiles(msgAttachments), this.statusElm);
            await this.filedest.isDone;
            promising_resolver();
        })();
    }
    /**
     * Run this after the HTML Element was made available.
     */
    async postConstructor() {
        await this.isDone;
        this.listFiles();
    }
}
