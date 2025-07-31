/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2025 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { UserStore, UploadHandler, DraftType } from "@webpack/common";

const logger = new Logger("AvatarCommand");

function loadImage(source: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.crossOrigin = "anonymous";
        img.src = source;
    });
}

function getHighQualityAvatarUrl(userObj: any, size: number = 1024): string {
    if (!userObj.avatar) {
        // Default avatars are only available in lower resolutions
        return `https://cdn.discordapp.com/embed/avatars/${userObj.discriminator % 5}.png`;
    }

    // Check if avatar is animated (GIF)
    const isAnimated = userObj.avatar.startsWith('a_');
    const extension = isAnimated ? 'gif' : 'png'; // Use PNG for static, GIF for animated

    return `https://cdn.discordapp.com/avatars/${userObj.id}/${userObj.avatar}.${extension}?size=${size}`;
}

export default definePlugin({
    name: "AvatarCommand",
    description: "Adds a /avatar command to display user or server member avatar in high quality",
    authors: [Devs.Aho],
    commands: [
        {
            inputType: ApplicationCommandInputType.BUILT_IN,
            name: "avatar",
            description: "Display high quality avatar of a user or server member",
            options: [
                {
                    name: "user",
                    description: "User or server member to display avatar for",
                    type: ApplicationCommandOptionType.USER,
                    required: true
                },
                {
                    name: "size",
                    description: "Avatar size (default: 1024)",
                    type: ApplicationCommandOptionType.INTEGER,
                    choices: [
                        { name: "512x512", value: 512 },
                        { name: "1024x1024", value: 1024 },
                        { name: "2048x2048", value: 2048 },
                        { name: "4096x4096", value: 4096 }
                    ]
                }
            ],
            execute: async (opts, cmdCtx) => {
                try {
                    const user = findOption(opts, "user");
                    const size = findOption(opts, "size") || 1024;

                    if (!user) {
                        return sendBotMessage(cmdCtx.channel.id, { content: "Please provide a user." });
                    }

                    const userObj = UserStore.getUser(user);
                    if (!userObj) {
                        return sendBotMessage(cmdCtx.channel.id, { content: "User not found." });
                    }

                    const avatarUrl = getHighQualityAvatarUrl(userObj, size);

                    // For animated avatars, we can just send the URL directly
                    if (userObj.avatar && userObj.avatar.startsWith('a_')) {
                        return sendBotMessage(cmdCtx.channel.id, {
                            content: `**${userObj.username}'s** animated avatar (${size}x${size}):\n${avatarUrl}`
                        });
                    }

                    // For static avatars, process through canvas for consistency
                    const canvas = document.createElement("canvas");
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext("2d")!;

                    // Enable image smoothing for better quality
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';

                    const img = await loadImage(avatarUrl);
                    ctx.drawImage(img, 0, 0, size, size);

                    canvas.toBlob(blob => {
                        if (!blob) {
                            sendBotMessage(cmdCtx.channel.id, { content: "Couldn't generate the image." });
                            return;
                        }

                        const fileName = `${userObj.username}_avatar_${size}x${size}.png`;
                        const file = new File([blob], fileName, { type: "image/png" });
                        UploadHandler.promptToUpload([file], cmdCtx.channel, DraftType.ChannelMessage);
                    }, "image/png", 0.95); // Higher quality PNG compression

                } catch (e: unknown) {
                    if (e instanceof Error) {
                        sendBotMessage(cmdCtx.channel.id, { content: e.message });
                    } else {
                        logger.error(e);
                    }
                }
            }
        }
    ]
});