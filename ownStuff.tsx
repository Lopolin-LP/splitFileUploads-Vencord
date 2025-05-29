/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import { saveFile } from "@utils/web";
import { ChannelStore, DraftType, PermissionsBits, PermissionStore, UploadHandler } from "@webpack/common";

/**
 * Prompts the user to choose one or multiple file from their system
 * @param mimeTypes A comma separated list of mime types to accept, see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/accept#unique_file_type_specifiers
 * @returns A promise that resolves to the chosen file or null if the user cancels
 * Stolen cutely from utils/web ; Note: My implementation is slightly different, so i cannot import directly
 */
export function chooseFiles(mimeTypes: string) {
    return new Promise<FileList | null>(resolve => {
        const input = document.createElement("input");
        input.type = "file";
        input.style.display = "none";
        input.accept = mimeTypes;
        input.multiple = true;
        input.onchange = async () => {
            resolve(input.files ?? null);
        };

        document.body.appendChild(input);
        input.click();
        setImmediate(() => document.body.removeChild(input));
    });
}

export async function downloadFile(file: File) {
    if (IS_DISCORD_DESKTOP) {
        DiscordNative.fileManager.saveWithDialog(new Uint8Array(await file.arrayBuffer()), file.name);
    } else {
        saveFile(file);
    }
}

export function notifErr(msg: string) {
    showNotification({
        title: "SFU Error",
        body: msg
    });
}

export function addAttachments(files: File[], channelId: string) {
    UploadHandler.promptToUpload(files, ChannelStore.getChannel(channelId), DraftType.ChannelMessage);
}

// Permission Infos and Attaching, stolen from plugins/fakeNitro
export function hasPermission(channelId: string, permission: bigint) {
    const channel = ChannelStore.getChannel(channelId);

    if (!channel || channel.isPrivate()) return true;

    return PermissionStore.can(permission, channel);
}

export const hasAttachmentPerms = (channelId: string) => hasPermission(channelId, PermissionsBits.ATTACH_FILES);
