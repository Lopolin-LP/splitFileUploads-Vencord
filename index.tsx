/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Lopolin
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

type NativeFile = globalThis.File;
import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { showNotification } from "@api/Notifications";
import {
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalProps,
    ModalRoot,
    openModal
} from "@utils/modal";
import definePlugin, { StartAt } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Alerts, Button, ChannelStore, DraftType, Forms, PermissionsBits, PermissionStore, React, SelectedChannelStore, showToast, Switch, TextInput, UploadHandler } from "@webpack/common";
import { Message, MessageAttachment } from "discord-types/general";

import { bytesToText, FileConstructor, FileDestructor, fileToFile, isValidSplitFile } from "./fileConstructor";
import { chooseFiles, downloadFile } from "./ownStuff";

function notifErr(msg: string) {
    showNotification({
        title: "SFU Error",
        body: msg
    });
}

// Permission Infos and Attaching, stolen from plugins/fakeNitro
function hasPermission(channelId: string, permission: bigint) {
    const channel = ChannelStore.getChannel(channelId);

    if (!channel || channel.isPrivate()) return true;

    return PermissionStore.can(permission, channel);
}
const hasAttachmentPerms = (channelId: string) => hasPermission(channelId, PermissionsBits.ATTACH_FILES);

type SFU_settings = { compress: boolean, split: boolean; name: string; };
type SFU_react_settings = { [K in keyof SFU_settings]: [SFU_settings[keyof SFU_settings], Function] };
class SFU {
    public default_settings: SFU_settings = {
        compress: true,
        split: true,
        name: "Unknown"
    };
    channelId: string;
    elm: HTMLElement | null = null;
    fileconst: FileConstructor;
    modalKey: string = "";
    table: HTMLElement | null = null;
    async start(settings: SFU_settings) {
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
        // On finish, attach to message
        const files = await this.fileconst.apply(settings);

        // Probably the best bet:
        // https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream/CompressionStream
        // https://www.npmjs.com/package/compression
        // https://www.npmjs.com/package/split-file
        // https://www.npmjs.com/package/tar

        // Attach Files
        UploadHandler.promptToUpload(files, ChannelStore.getChannel(this.channelId), DraftType.ChannelMessage);
        // closeModal(this.modalKey);
        showToast("Finished SFU, you may now send your message.", "success", { duration: 3000 });
    }
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
        Array.from(list).forEach((file: NativeFile) => {
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
    setElm(elm: HTMLElement) {
        if (this.elm !== null) return; // Fail silently, this is due to Reacts Renderer
        if (elm === null) return notifErr("setElm elm was null!");
        if (!elm.classList.contains("splitFileUploadModal")) return;
        this.elm = elm;
        this.table = elm.querySelector("table");
    }
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
    constructor() {
        this.fileconst = new FileConstructor();
        this.channelId = SelectedChannelStore.getChannelId();
    }
    postConstructor() {
        this.updateFileSizes();
    }
}

const discordFilesCache: { [key: string]: File; } = {};

class SFD {
    filedest: FileDestructor | undefined;
    isDone: Promise<void>; // Is done AFTER filedest.isDone
    elm: HTMLElement | null = null;
    table: HTMLElement | null = null;
    isElm: Promise<void>;
    // @ts-ignore that's a lie
    isElmResolver: () => void;
    modalKey: string = "";
    statusElm: HTMLElement;
    downloadDiscordFiles(attachments: MessageAttachment[]): Promise<File[]> {
        return Promise.all(attachments.filter(attach => isValidSplitFile(attach.filename)).map(async attach => {
            let promising: Promise<File>;
            const status = this.statusElm;
            status.innerText = "Downloading Files";
            if (discordFilesCache[attach.id]) {
                // Grab it from cache, not to burden discords servers!
                promising = new Promise(res => {
                    status.innerText = "Received from Cache!";
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
                        const outfile = new File([xhr.response], attach.filename);
                        status.innerText = "Downloaded!";
                        promising_resolver(outfile);
                        discordFilesCache[attach.id] = outfile; // Cache it
                    } else {
                        console.error("Failed!", xhr.status, xhr.response, xhr);
                        status.innerText = "Failed Download!";
                        promising_resolver(fileToFile([], undefined));
                    }
                };
                xhr.onerror = function (e) {
                    console.error("There was an error", e, xhr);
                };
                xhr.send();
            }
            return promising;
        }));
    }
    setElm(elm: HTMLElement) {
        if (this.elm !== null) return; // Fail silently, this is due to Reacts Renderer
        if (elm === null) return notifErr("setElm elm was null!");
        if (!elm.classList.contains("splitFileUploadModal")) return;
        this.elm = elm;
        this.table = elm.querySelector("table");
        this.elm.querySelector(".splitFileUploadStatus")?.append(this.statusElm);
        this.isElmResolver();
    }
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
    downloadAll() {
        if (this.filedest?.final) downloadFile(this.filedest.final);
    }
    downloadSpecificFile(index: number) {
        const file = this.filedest?.parsedFiles[index];
        if (file) downloadFile(file);
    }
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
            const textUnparsable = (): string => { if (this.filedest?.unparsable) return ` There were ${this.filedest?.unparsable} unparsable entities.`; else return ""; };
            (this.elm?.querySelector(".sfuInfo") as HTMLElement).innerText = "Entries without download button are directories." + textUnparsable();
        }
    }
    constructor(message: Message) {
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
        (async () => {
            // @ts-expect-error bruh.
            this.filedest = new FileDestructor(await this.downloadDiscordFiles(message.attachments), this.statusElm);
            await this.filedest.isDone;
            promising_resolver();
        })();
    }
    async postConstructor() {
        await this.isDone;
        this.listFiles();
    }
}

// Uploading

export function OpenUploadModal(): any {
    const SFU_inst = new SFU();
    let promising_resolver;
    const promising = new Promise(res => promising_resolver = res);
    function UploadModal_internal(props: ModalProps): any {
        const [compress, setCompress] = React.useState(SFU_inst.default_settings.compress);
        const [split, setSplit] = React.useState(SFU_inst.default_settings.split);
        const [name, setName] = React.useState(SFU_inst.default_settings.name);
        return (
            <ModalRoot {...props}>
                {/* Heavily copied from plugins/invisibleChat.desktop and plugins/translate */}
                {/* Open Popup for stuff */}
                <ModalHeader>
                    <Forms.FormTitle tag="h4">Compress & Split Files</Forms.FormTitle>
                </ModalHeader>

                <ModalContent>
                    <Button
                        color={Button.Colors.BRAND_NEW}
                        style={{ width: "100%", height: "5em", textAlign: "center" }}
                        onClick={async () => {
                            const files = await chooseFiles("*/*");
                            if (files) SFU_inst.addFiles(files);
                        }}
                    >
                        Attach File(s)
                    </Button>
                    <ModalContent>
                        {/* Worst way to approach this, but f it. */}
                        <div className="splitFileUploadModal" ref={function (el) { el && SFU_inst.setElm(el); promising_resolver(); }}>
                            <table className="sfuList"></table>
                            <table className="sfuData">
                                <tr>
                                    <td>Current total: </td><td className="currentTotalFileSize"></td>
                                </tr>
                                <tr>
                                    <td>Current required splits: </td><td className="currentRequiredSplits"></td>
                                </tr>
                                <tr>
                                    <td>Per file max. size: </td><td className="maxSingleFileSize"></td>
                                </tr>
                            </table>
                        </div>
                    </ModalContent>
                    <TextInput
                        style={{ marginBottom: "20px" }}
                        defaultValue={""}
                        placeholder={"File name"}
                        onChange={(e: string) => {
                            setName(e);
                        }}
                    />
                    <Switch
                        key="sfu_compress"
                        value={compress}
                        onChange={(e: boolean) => {
                            setCompress(e);
                        }}
                    >
                        Use compression (.tar.gz)
                    </Switch>
                    <Switch
                        key="sfu_split"
                        value={split}
                        onChange={(e: boolean) => {
                            setSplit(e);
                        }}
                    >
                        Split files (.001)
                    </Switch>
                </ModalContent>

                <ModalFooter>
                    <Button
                        color={Button.Colors.GREEN}
                        // disabled={!isValid}
                        onClick={() => {
                            SFU_inst.start({ compress: compress, split: split, name: name });
                            props.onClose();
                        }}
                    >
                        Compute & Attach
                    </Button>
                    <Button
                        color={Button.Colors.TRANSPARENT}
                        look={Button.Looks.LINK}
                        style={{ left: 15, position: "absolute" }}
                        onClick={() => {
                            props.onClose();
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        color={Button.Colors.TRANSPARENT}
                        look={Button.Looks.LINK}
                        // style={{ left: 15, bottom: 40, position: "absolute" }}
                        onClick={() => {
                            props.onClose();
                        }}
                    >
                        More
                    </Button>
                </ModalFooter>
            </ModalRoot>
        );
    }
    SFU_inst.modalKey = openModal(props => <UploadModal_internal {...props} />);
    (async () => {
        await promising;
        SFU_inst.postConstructor.bind(SFU_inst);
    })();
}

const UploadStore = findByPropsLazy("getUploads");

const uploadButton: ChatBarButtonFactory = ({ isMainChat, type: { attachments } }) => {
    // Heavily copied from plugins/previewMessage
    const channelId = SelectedChannelStore.getChannelId();
    // const draft = useStateFromStores([DraftStore], () => getDraft(channelId));

    if (!isMainChat) return null;

    const hasAttachments = attachments && UploadStore.getUploads(channelId, DraftType.ChannelMessage).length > 0;

    return (
        <ChatBarButton
            tooltip="Split Files"
            onClick={async () => {
                OpenUploadModal();
            }}
            buttonProps={{
                style: {
                    translate: "0 0px"
                }
            }}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ scale: "1.096", translate: "0 -1px" }}
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M21 12a9 9 0 1 0 -9 9" />
                <path d="M3.6 9h16.8" />
                <path d="M3.6 15h8.4" />
                <path d="M11.578 3a17 17 0 0 0 0 18" />
                <path d="M12.5 3c1.719 2.755 2.5 5.876 2.5 9" />
                <path d="M18 21v-7m3 3l-3 -3l-3 3" />
            </svg>
        </ChatBarButton>
    );
};

// Downloading

export function OpenDownloadModal(message: Message): any {
    const SFD_inst = new SFD(message);
    let promising_resolver;
    const promising = new Promise(res => promising_resolver = res);
    function OpenDownloadModal_internal(props: ModalProps): any {
        return (
            <ModalRoot {...props}>
                <ModalHeader>
                    <Forms.FormTitle tag="h4">Download Combined Files</Forms.FormTitle>
                </ModalHeader>
                <ModalContent>
                    {/* Worst way to approach this, but f it. */}
                    <div className="splitFileUploadModal" ref={function (el) { el && SFD_inst.setElm(el); promising_resolver(); }}>
                        <div className="splitFileUploadStatus"></div>
                        <table className="sfuList"></table>
                        <table>
                            <tr>
                                <td className="sfuInfo"></td>
                            </tr>
                        </table>
                    </div>
                </ModalContent>
                <ModalFooter>
                    <Button
                        color={Button.Colors.GREEN}
                        // disabled={!isValid}
                        onClick={() => {
                            SFD_inst.downloadAll();
                            props.onClose();
                        }}
                    >
                        Download
                    </Button>
                    <Button
                        color={Button.Colors.TRANSPARENT}
                        look={Button.Looks.LINK}
                        style={{ left: 15, position: "absolute" }}
                        onClick={() => {
                            props.onClose();
                        }}
                    >
                        Cancel
                    </Button>
                </ModalFooter>
            </ModalRoot>
        );
    }
    SFD_inst.modalKey = openModal(props => <OpenDownloadModal_internal {...props} />);
    (async () => {
        await promising;
        setTimeout(SFD_inst.postConstructor.bind(SFD_inst), 1000); // TODO: Make it wait until immediately after the UI was created.
    })();
}

function downloadIcon() {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
        <path d="M7 11l5 5l5 -5" />
        <path d="M12 4l0 12" />
    </svg>;
}

// Plugin Definition

export default definePlugin({
    name: "SplitFileUploads",
    description: "Allow more file uploads by compressing and splitting files.",
    authors: [{ name: "Lopolin", id: 629692905480650763n }],
    renderChatBarButton: uploadButton,
    renderMessagePopoverButton: message => {
        // IF there's no attachments, don't even bother
        if (message.attachments.length === 0) return null;
        // If there's no attachments with .001, don't even bother
        if (message.attachments.filter(attachment => attachment.filename.endsWith(".001")).length === 0) return null;
        // Taken from plugins/translate
        return {
            label: "Download Split Files",
            icon: downloadIcon,
            message,
            channel: ChannelStore.getChannel(message.channel_id),
            onClick: async () => {
                OpenDownloadModal(message);
            }
        };
    },
    startAt: StartAt.Init,
    // start() {
    //     "hi";
    // }
});
