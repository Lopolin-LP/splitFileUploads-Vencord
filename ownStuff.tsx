/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import { saveFile } from "@utils/web";
import { ChannelStore, DraftType, PermissionsBits, PermissionStore, UploadHandler } from "@webpack/common";

/**
 * Prompts the user to choose one or multiple file from their system. Vencord has a built-in function under the (almost?) exact same, however it prompts only for a single file, while we allow multiple.
 * @param mimeTypes A comma separated list of mime types to accept, see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/accept#unique_file_type_specifiers
 * @returns A promise that resolves to the chosen file or null if the user cancels
 * Stolen cutely from utils/web
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

/**
 * Prompts the user to download a given file. It's a small wrapper, using either discord's native download function (on Electron) or using a websites download function.
 * @param file The file to download
 */
export async function downloadFile(file: File) {
    if (IS_DISCORD_DESKTOP) {
        DiscordNative.fileManager.saveWithDialog(new Uint8Array(await file.arrayBuffer()), file.name);
    } else {
        saveFile(file);
    }
}

/**
 * A general function for alerting the user when there's a problem, because I am not writing _that_ every time.
 * @param msg The message to display to the user
 */
export function notifErr(msg: string) {
    showNotification({
        title: "SFU Error",
        body: msg
    });
}

/**
 * A wrapper for adding attachments to a channel.
 * @param files The files to attach
 * @param channelId The channel to attach them to
 */
export function addAttachments(files: File[], channelId: string) {
    UploadHandler.promptToUpload(files, ChannelStore.getChannel(channelId), DraftType.ChannelMessage);
}

// Permission Infos and Attaching, stolen from plugins/fakeNitro
/**
 * Checks if the user has a specific Permission.
 * @param channelId The channel to check them in
 * @param permission The permission number to check for
 * @returns true if the permission is granted, otherwise false.
 */
export function hasPermission(channelId: string, permission: bigint) {
    const channel = ChannelStore.getChannel(channelId);

    if (!channel || channel.isPrivate()) return true;

    return PermissionStore.can(permission, channel);
}

/**
 * A wrapper around `hasPermission` to check if we can even add attachments.
 * @param channelId The channel id to check in
 * @returns true if we can add attachments, false otherwise.
 */
export const hasAttachmentPerms = (channelId: string) => hasPermission(channelId, PermissionsBits.ATTACH_FILES);
