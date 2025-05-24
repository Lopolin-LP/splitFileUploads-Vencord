/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { saveFile } from "@utils/web";

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
