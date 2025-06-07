/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CspPolicies } from "@main/csp";

const findHeader = (headers: typeof CspPolicies, headerName: Lowercase<string>) => {
    return Object.keys(headers).find(h => h.toLowerCase() === headerName);
};

export function modifyCorsForCDNattachments(url: string, responseHeaders: Record<string, string[]>) {
    // Fix CORS
    if (url.startsWith("https://cdn.discordapp.com/attachments/")) {
        const header = findHeader(responseHeaders, "access-control-allow-origin");
        if (header) return;
        responseHeaders["Access-Control-Allow-Origin"] = ["*"];
        responseHeaders["Access-Control-Allow-Methods"] = ["GET, POST, OPTIONS"];
    }
}
