/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { GuildRoleStore, GuildStore, useEffect } from "@webpack/common";
import { Channel } from "discord-types/general";

import { GuildMemberRequesterStore, GuildMemberStore, RelationshipStore } from "../../stores";
import { FullGuildMember, FullUser, Member } from "../../types";
import { useStores } from "../misc/useStores";

export function useMember(user: FullUser | null, channel: Channel | null): Member {
    const userId = user?.id;
    const guildId = channel?.guild_id;

    useEffect(() => {
        // Only request if both userId and guildId exist
        if (userId && guildId) {
            GuildMemberRequesterStore.requestMember(guildId, userId);
        }
    }, [guildId, userId]);

    const member = GuildMemberStore.use(
        ($) => {
            if (!guildId || !userId) return null;
            return $.getMember(guildId, userId) as FullGuildMember | null;
        },
        [guildId, userId]
    );

    const { guild, guildRoles } = useStores(
        [GuildStore, GuildRoleStore],
        (guildStore, guildRoleStore) => {
            if (!guildId) return { guild: null, guildRoles: undefined };

            const guild = guildStore.getGuild(guildId);
            const guildRoles = guild ? guildRoleStore.getRolesSnapshot(guild.id) : undefined;
            return { guild, guildRoles };
        },
        [guildId]
    );

    const friendNickname = RelationshipStore.use(
        ($) => {
            if (!userId || !channel?.isPrivate?.()) return null;
            return $.getNickname(userId);
        },
        [userId, channel]
    );

    const userName = user?.global_name || user?.globalName || user?.username || "???";

    // Early returns with proper fallbacks
    if (!user?.id) {
        return { nick: "???" };
    }

    if (!channel) {
        return { nick: userName };
    }

    // For DM channels or channels without guild
    if (!guildId || !guild?.id) {
        return {
            nick: friendNickname ?? userName,
            userId: user.id
        };
    }

    // If no member data available yet, return basic info
    if (!member) {
        return {
            nick: userName,
            userId: user.id,
            guildId: guild.id
        };
    }

    // Full member data available
    return {
        ...member,
        userId: user.id, // Ensure userId is always present
        nick: member.nick ?? userName,
        colorRoleName: member.colorRoleId && guildRoles?.[member.colorRoleId]
            ? guildRoles[member.colorRoleId].name
            : undefined,
        guildMemberAvatar: member.avatar,
        guildMemberAvatarDecoration: member.avatarDecoration,
        primaryGuild: user.primaryGuild,
        guildId: guild.id,
    };
}
