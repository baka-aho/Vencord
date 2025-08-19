/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./spotimbed.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import type { Embed, Message } from "@vencord/discord-types";

import { createSpotimbed, Spotimbed, SpotimbedProps } from "./components/Embed";
import { settings } from "./settings";
import { ResourceType } from "./types";
import { createEmbedData, getEmbeddableLinks } from "./utils/ast";

export default definePlugin({
    name: "SpotiMbed",
    description: "Makes Spotify embeds reliable and actually useable",
    authors: [Devs.Vap],
    patches: [
        {
            find: "=this.renderEmbeds(",
            replacement: {
                // .renderEmbeds = function(message) { ... }
                match: /\brenderEmbeds\((\i)\)\{/,
                // .renderEmbeds = function(message) { message = patchedMessage }
                replace: "$&$1=$self.patchMessage($1);",
            }
        },
        {
            find: ".embedSpotify",
            replacement: {
                // "Spotify" === embed.provider.name ? <DiscordEmbed embed={embed} /> : ...
                match: /let\{className:[^;]{0,50}embed:[^;]{0,50}=(\i);/,
                // "Spotify" === embed.provider.name ? <SpotiMbed embed={embed} /> : ...
                replace: "return $self.createSpotimbed($1.embed);$&",
            },
        },
        {
            find: ".PLAYER_DEVICES",
            replacement: {
                // get: request.bind(null, methods.get)
                match: /get:(\i)\.bind\(null,(\i(?:\.\i)?)\.get\)/,
                // post: request.bind(null, methods.post), get: ...
                replace: "post:$1.bind(null,$2.post),vcSpotifyMarker:1,$&",
            },
        },
        {
            find: "getActiveSocketAndDevice(){",
            replacement: {
                // store.hasConnectedAccount = function() { return Object.keys(accounts) ...
                match: /(?=hasConnectedAccount\(\)\{return Object\.keys\((\i)\))/,
                // store.getConnectedAccounts = function() { return accounts }; store.hasConnectedAccount = ...
                replace: "getConnectedAccounts(){return $1}",
            },
        }
    ],
    settings,

    settingsAboutComponent: ({ tempSettings }: { tempSettings?: SpotimbedProps["tempSettings"]; }) => <ErrorBoundary>
        <Spotimbed type={ResourceType.Track} id="6a4z5B7vOzTLYTnokxuDXo" tempSettings={tempSettings} />
        <Spotimbed type={ResourceType.Album} id="6MbBpKe8dZYYqOq0AxpQps" tempSettings={tempSettings} />
    </ErrorBoundary>,

    // exports
    createSpotimbed,
    Spotimbed,
    patchMessage: (message: Message): Message => {
        const embeds = message.embeds.filter(e => e.provider?.name !== "Spotify");

        const links = getEmbeddableLinks(message.content, "open.spotify.com");
        embeds.push(...links.map(link => createEmbedData(link) as Embed));

        return new Proxy(message, {
            get(target, prop) {
                if (prop === "embeds") return embeds;
                return Reflect.get(target, prop);
            }
        });
    },
});
