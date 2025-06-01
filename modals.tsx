/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import {
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalProps,
    ModalRoot,
    openModal
} from "@utils/modal";
import { Button, ChannelStore, ContextMenuApi, FluxDispatcher, Forms, Menu, React, SelectedChannelStore, showToast, Switch, Text, TextArea, TextInput } from "@webpack/common";
import { Message } from "discord-types/general";
import { ReactNode } from "react";

import { currentSMU, SFD, SFU, SMD, SMU } from "./fileWrapper";
import { chooseFiles } from "./ownStuff";

// Uploading

/**
 * This function opens the modal to upload things. No parameters needed.
 */
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
                        onDrop={e => {
                            const { files } = e.dataTransfer;
                            if (files) {
                                SFU_inst.addFiles(files);
                            }
                        }}
                    >
                        Attach file(s) or drop them here!
                    </Button>
                    {/* Worst way to approach this, but f it. */}
                    <div className="splitFileUploadModal" ref={function (el) { if (el) { SFU_inst.setElm(el); promising_resolver(); } }}>
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
                        onClick={async () => {
                            const result = await SFU_inst.start({ compress: compress, split: split, name: name });
                            if (result) props.onClose();
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
                            OpenMultiModal();
                            props.onClose();
                        }}
                    >
                        Multi-Download
                    </Button>
                </ModalFooter>
            </ModalRoot>
        );
    }
    SFU_inst.modalKey = openModal(props => <UploadModal_internal {...props} />);
    (async () => {
        await promising;
        SFU_inst.postConstructor.bind(SFU_inst)();
    })();
}

/**
 * This a react element that is used by `renderChatBarButton` in the `definePlugin` function in index.tsx. It's the upload button you find in the chat bar.
 * @param param0 idk man
 * @returns The react element as a ChatBarButtonFactory
 */
export const uploadButton: ChatBarButtonFactory = ({ isMainChat, type: { attachments } }) => {
    // Heavily copied from plugins/previewMessage
    if (!isMainChat) return null;
    return (
        <ChatBarButton
            tooltip="Split Files"
            onClick={async () => {
                OpenUploadModal();
            }}
            onContextMenu={OpenMultiContextMenu}
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

/**
 * This function opens the modal to download things.
 * @param message The message or an array of messages to get the attachments from
 */
export function OpenDownloadModal(message: Message | Message[]): any {
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
                        <table className="sfuInfoParent">
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
        SFD_inst.postConstructor.bind(SFD_inst)();
    })();
}

/**
 * This a react element that is used by `messageAccessory`. It's the download button you find when hovering a message with split files.
 */
export const downloadIcon = () => {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
        <path d="M7 11l5 5l5 -5" />
        <path d="M12 4l0 12" />
    </svg>;
};

// Multi-Message

/**
 * This function opens the modal to download things when it's split across multiple messages. It's accessed from the Upload Modal.
 */
export function OpenMultiModal(): any {
    let promising_resolver;
    const promising = new Promise(res => promising_resolver = res);
    function OpenMultiModal_internal(props: ModalProps): any {
        // https://stackoverflow.com/a/73487544
        const [messageURLsText, setMessageURLsText] = React.useState("");
        return (
            <ModalRoot {...props}>
                {/* Heavily copied from plugins/invisibleChat.desktop and plugins/translate */}
                {/* Open Popup for stuff */}
                <ModalHeader>
                    <Forms.FormTitle tag="h4">Multi Download Combined Files</Forms.FormTitle>
                </ModalHeader>

                <ModalContent>
                    <Text>Use this to download files which were sent across multiple messages.</Text>
                    <br />
                    <Text>Put the URLs to the messages with attachments here. Each new line is one link.</Text>
                    <br />
                    <TextArea
                        onChange={setMessageURLsText}
                        placeholder={"https://discord.com/channels/…/…/…\nhttps://discord.com/channels/…/…/…"}
                    />
                    <br />
                    <Text style={{ color: "var(--text-muted)" }}>Note: you can also add only one link.</Text>
                    <br />
                </ModalContent>

                <ModalFooter>
                    <Button
                        color={Button.Colors.GREEN}
                        onClick={() => {
                            const msgs = new SMD(messageURLsText.split("\n")).parsedMessages;
                            if (msgs.length > 0) {
                                OpenDownloadModal(msgs);
                                props.onClose();
                            } else {
                                showToast("Please provide at least one link!", "error");
                            }
                        }}
                    >
                        Download Split Files
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
    // SFU_inst.modalKey = openModal(props => <UploadModal_internal {...props} />);
    // (async () => {
    //     await promising;
    //     SFU_inst.postConstructor.bind(SFU_inst);
    // })();
    openModal(props => <OpenMultiModal_internal {...props} />);
}

/**
 * This function opens the context menu used when uploading more than 10 Files. You access it by right-clicking the `uploadButton`, i.e. accessing the Context Menu.
 * @param onContextMenuEvent The react event received from the `onContextMenu` property
 */
export function OpenMultiContextMenu(onContextMenuEvent: React.MouseEvent) {
    const currentChannelId = SelectedChannelStore.getChannelId();
    const menuItems = () => {
        let selectedSMU: SMU | undefined = currentSMU[currentChannelId];
        if (selectedSMU) {
            const toReturn: ReactNode[] = [];
            selectedSMU.getStuffForMenu().forEach(item => {
                toReturn.push((
                    <Menu.MenuItem
                        id={("sfu_smu_" + (Math.random() * 100).toFixed(0))}
                        label={item.label}
                        action={item.exec}
                    />
                ));
            });
            toReturn.push((
                <Menu.MenuSeparator />
            ), (
                <Menu.MenuItem
                    id="sfu_smu_remove"
                    label="Remove Files from Memory"
                    color="danger"
                    action={() => { selectedSMU?.delete(); selectedSMU = undefined; }}
                />
            ));
            return toReturn;
        } else {
            return [(
                <Menu.MenuItem
                    id="sfu_smu_noItems"
                    label="There's no queued files for this channel!"
                />
            ) as ReactNode];
        }
    };
    ContextMenuApi.openContextMenu(onContextMenuEvent, () => (
        <Menu.Menu
            navId="sfu_smu"
            onClose={() => FluxDispatcher.dispatch({ type: "CONTEXT_MENU_CLOSE" })}
            aria-label="Split File Uploader - Split Multi Uploader"
        >
            {menuItems()}
        </Menu.Menu>
    ));
}

// Message Accessory

/**
 * This a react element that is used by `renderMessagePopoverButton` in the `definePlugin` function in index.tsx. It uses `downloadIcon` as the icon. This one calls `OpenDownloadModal` with the corresponding message.
 * @param message The message to open the download modal with
 * @returns I assume a function?
 */
export const messageAccessory = message => {
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
};
