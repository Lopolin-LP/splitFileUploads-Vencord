/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Lopolin
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import definePlugin, { StartAt } from "@utils/types";

import { messageAccessory, uploadButton } from "./modals";

// Plugin Definition

export default definePlugin({
    name: "SplitFileUploads",
    description: "Allow more file uploads by compressing and splitting files.",
    authors: [{ name: "Lopolin", id: 629692905480650763n }],
    renderChatBarButton: uploadButton,
    renderMessagePopoverButton: messageAccessory,
    startAt: StartAt.Init
});
