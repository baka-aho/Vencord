/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
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

import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { Margins } from "@utils/margins";
import { wordsToTitle } from "@utils/text";
import definePlugin, { ReporterTestable } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Button, ChannelStore, Forms, GuildMemberStore, SelectedChannelStore, SelectedGuildStore, useMemo, UserStore } from "@webpack/common";
import { ReactElement } from "react";

import { getCurrentVoice, settings } from "./settings";

interface VoiceState {
    userId: string;
    channelId?: string;
    oldChannelId?: string;
    deaf: boolean;
    mute: boolean;
    selfDeaf: boolean;
    selfMute: boolean;
}

const VoiceStateStore = findByPropsLazy("getVoiceStatesForChannel", "getCurrentClientVoiceChannelId");

// Mute/Deaf for other people than you is commented out, because otherwise someone can spam it and it will be annoying
// Filtering out events is not as simple as just dropping duplicates, as otherwise mute, unmute, mute would
// not say the second mute, which would lead you to believe they're unmuted

async function speak(text: string, { volume, rate } = settings.store) {
    if (text.trim().length === 0) return;
    try {
        const voice = getCurrentVoice();
        if (!voice) {
            throw new Error("No voice selected");
        }

        const response = await fetch("https://tiktok-tts.weilnet.workers.dev/api/generation", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: text,
                voice: voice.id
            })
        });

        if (!response.ok) {
            throw new Error(`TTS API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data?.success) {
            throw new Error(data?.error || "Unknown TTS API error");
        }

        // Convert base64 audio data to ArrayBuffer
        const binaryString = atob(data.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);

        const audio = new Audio(url);
        audio.volume = volume;
        audio.playbackRate = rate;

        // Clean up object URL after playback completes
        audio.addEventListener("ended", () => {
            URL.revokeObjectURL(url);
        }, { once: true });

        await audio.play();
    } catch (error) {
        new Logger("CustomVcNarrator").error("Failed to play TTS:", error);
    }
}

function clean(str: string) {
    const replacer = settings.store.latinOnly
        ? /[^\p{Script=Latin}\p{Number}\p{Punctuation}\s]/gu
        : /[^\p{Letter}\p{Number}\p{Punctuation}\s]/gu;

    return str.normalize("NFKC")
        .replace(replacer, "")
        .replace(/_{2,}/g, "_")
        .trim();
}

function processConditionals(str: string) {
    // Process conditional statements: [[IF]{{SELF}}=={{USER}};TEXT1;TEXT2]
    return str.replace(/\[\[IF\]([^;]+)==([^;]+);([^;]*);([^\]]*)\]/g, (match, condition1, condition2, text1, text2) => {
        // Trim whitespace from conditions
        const cond1 = condition1.trim();
        const cond2 = condition2.trim();

        // Compare the conditions (case-insensitive for better matching)
        return cond1.toLowerCase() === cond2.toLowerCase() ? text1 : text2;
    });
}

function formatText(str: string, user: string, channelNew: string, channelOld: string, displayName: string, nickname: string, isMe: boolean) {
    const currentUser = UserStore.getCurrentUser();
    const selfName = clean(currentUser.username) || "You";
    const selfDisplayName = clean(currentUser.globalName ?? currentUser.username) || "You";
    const myGuildId = SelectedGuildStore.getGuildId();
    const selfNickname = clean(GuildMemberStore.getNick(myGuildId!, currentUser.id) ?? currentUser.username) || "You";

    // First replace all placeholders
    let result = str
        .replaceAll("{{SELF}}", selfName)
        .replaceAll("{{USER}}", isMe ? selfName : (clean(user) || (user ? "Someone" : "")))
        .replaceAll("{{CHANNELNEW}}", clean(channelNew) || "channel")
        .replaceAll("{{CHANNELOLD}}", clean(channelOld) || "channel")
        .replaceAll("{{DISPLAY_NAME}}", isMe ? selfDisplayName : (clean(displayName) || (displayName ? "Someone" : "")))
        .replaceAll("{{NICKNAME}}", isMe ? selfNickname : (clean(nickname) || (nickname ? "Someone" : "")));

    // Then process conditionals
    result = processConditionals(result);

    return result;
}

/*
let StatusMap = {} as Record<string, {
    mute: boolean;
    deaf: boolean;
}>;
*/

// For every user, channelId and oldChannelId will differ when moving channel.
// Only for the local user, channelId and oldChannelId will be the same when moving channel,
// for some ungodly reason
let myLastChannelId: string | undefined;

function getTypeAndChannelInfo({ channelId, oldChannelId }: VoiceState, isMe: boolean) {
    if (isMe && channelId !== myLastChannelId) {
        oldChannelId = myLastChannelId;
        myLastChannelId = channelId;
    }

    if (channelId !== oldChannelId) {
        if (channelId) {
            return {
                type: oldChannelId ? "move" : "join",
                newChannelId: channelId,
                oldChannelId: oldChannelId
            };
        }
        if (oldChannelId) {
            return {
                type: "leave",
                newChannelId: null,
                oldChannelId: oldChannelId
            };
        }
    }
    /*
    if (channelId) {
        if (deaf || selfDeaf) return ["deafen", channelId];
        if (mute || selfMute) return ["mute", channelId];
        const oldStatus = StatusMap[userId];
        if (oldStatus.deaf) return ["undeafen", channelId];
        if (oldStatus.mute) return ["unmute", channelId];
    }
    */
    return { type: "", newChannelId: null, oldChannelId: null };
}

/*
function updateStatuses(type: string, { deaf, mute, selfDeaf, selfMute, userId, channelId }: VoiceState, isMe: boolean) {
    if (isMe && (type === "join" || type === "move")) {
        StatusMap = {};
        const states = VoiceStateStore.getVoiceStatesForChannel(channelId!) as Record<string, VoiceState>;
        for (const userId in states) {
            const s = states[userId];
            StatusMap[userId] = {
                mute: s.mute || s.selfMute,
                deaf: s.deaf || s.selfDeaf
            };
        }
        return;
    }

    if (type === "leave" || (type === "move" && channelId !== SelectedChannelStore.getVoiceChannelId())) {
        if (isMe)
            StatusMap = {};
        else
            delete StatusMap[userId];

        return;
    }

    StatusMap[userId] = {
        deaf: deaf || selfDeaf,
        mute: mute || selfMute
    };
}
*/

function playSample(tempSettings: any, type: string) {
    const s = Object.assign({}, settings.plain, tempSettings);
    const currentUser = UserStore.getCurrentUser();
    const myGuildId = SelectedGuildStore.getGuildId();

    speak(formatText(
        s[type + "Message"],
        currentUser.username,
        "general", // channelNew
        "lobby", // channelOld
        currentUser.globalName ?? currentUser.username,
        GuildMemberStore.getNick(myGuildId!, currentUser.id) ?? currentUser.username,
        true // isMe = true for sample
    ), s);
}

export default definePlugin({
    name: "CustomVcNarrator",
    description: "Announces when users join, leave, or move voice channels via narrator. TikTok TTS version; speechSynthesis is pretty boring",
    authors: [Devs.Ven, Devs.Nyako, Devs.Loukious],
    reporterTestable: ReporterTestable.None,

    settings,

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            const myGuildId = SelectedGuildStore.getGuildId();
            const myChanId = SelectedChannelStore.getVoiceChannelId();
            const myId = UserStore.getCurrentUser().id;

            if (ChannelStore.getChannel(myChanId!)?.type === 13 /* Stage Channel */) return;

            for (const state of voiceStates) {
                const { userId, channelId, oldChannelId } = state;
                const isMe = userId === myId;
                if (!isMe) {
                    if (!myChanId) continue;
                    if (channelId !== myChanId && oldChannelId !== myChanId) continue;
                }

                const { type, newChannelId, oldChannelId: actualOldChannelId } = getTypeAndChannelInfo(state, isMe);
                if (!type) continue;

                const template = settings.store[type + "Message"];
                const user = UserStore.getUser(userId).username;
                const displayName = (UserStore.getUser(userId) as any).globalName ?? user;
                const nickname = GuildMemberStore.getNick(myGuildId!, userId) ?? user;

                // Properly determine channel names based on event type
                let channelNew = "";
                let channelOld = "";

                if (type === "join") {
                    channelNew = newChannelId ? ChannelStore.getChannel(newChannelId).name : "";
                    channelOld = "";
                } else if (type === "leave") {
                    channelNew = "";
                    channelOld = actualOldChannelId ? ChannelStore.getChannel(actualOldChannelId).name : "";
                } else if (type === "move") {
                    channelNew = newChannelId ? ChannelStore.getChannel(newChannelId).name : "";
                    channelOld = actualOldChannelId ? ChannelStore.getChannel(actualOldChannelId).name : "";
                }

                speak(formatText(template, user, channelNew, channelOld, displayName, nickname, isMe));

                // updateStatuses(type, state, isMe);
            }
        },

        AUDIO_TOGGLE_SELF_MUTE() {
            const chanId = SelectedChannelStore.getVoiceChannelId()!;
            const s = VoiceStateStore.getVoiceStateForChannel(chanId) as VoiceState;
            if (!s) return;

            const event = s.mute || s.selfMute ? "unmute" : "mute";
            const channelName = ChannelStore.getChannel(chanId).name;
            speak(formatText(settings.store[event + "Message"], "", channelName, "", "", "", true));
        },

        AUDIO_TOGGLE_SELF_DEAF() {
            const chanId = SelectedChannelStore.getVoiceChannelId()!;
            const s = VoiceStateStore.getVoiceStateForChannel(chanId) as VoiceState;
            if (!s) return;

            const event = s.deaf || s.selfDeaf ? "undeafen" : "deafen";
            const channelName = ChannelStore.getChannel(chanId).name;
            speak(formatText(settings.store[event + "Message"], "", channelName, "", "", "", true));
        }
    },

    settingsAboutComponent({ tempSettings: s }) {

        const types = useMemo(
            () => Object.keys(settings.def).filter(k => k.endsWith("Message")).map(k => k.slice(0, -7)),
            [],
        );

        const errorComponent: ReactElement<any> | null = null;

        return (
            <Forms.FormSection>
                <Forms.FormText>
                    You can customise the spoken messages below. You can disable specific messages by setting them to nothing
                </Forms.FormText>
                <Forms.FormText>
                    The special placeholders <code>{"{{USER}}"}</code>, <code>{"{{SELF}}"}</code>, <code>{"{{DISPLAY_NAME}}"}</code>, <code>{"{{NICKNAME}}"}</code>, <code>{"{{CHANNELNEW}}"}</code> and <code>{"{{CHANNELOLD}}"}</code>{" "}
                    will be replaced with the user's name (for others), your own name, the user's display name, the user's nickname on current server, the new channel's name and the old channel's name respectively
                </Forms.FormText>
                <Forms.FormText>
                    You can use conditional formatting: <code>{"[[IF]{{SELF}}=={{USER}};TEXT1;TEXT2]"}</code> will show TEXT1 if it's yourself, TEXT2 if it's someone else
                </Forms.FormText>
                <Forms.FormTitle className={Margins.top20} tag="h3">Play Example Sounds</Forms.FormTitle>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: "1rem",
                    }}
                    className={"vc-narrator-buttons"}
                >
                    {types.map(t => (
                        <Button key={t} onClick={() => playSample(s, t)}>
                            {wordsToTitle([t])}
                        </Button>
                    ))}
                </div>
                {errorComponent}
            </Forms.FormSection>
        );
    }
});