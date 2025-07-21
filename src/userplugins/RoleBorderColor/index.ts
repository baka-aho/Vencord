/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
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
import definePlugin from "@utils/types";

export default definePlugin({
    name: "RoleBorderColor",
    description: "Applies a neon glow to role pills with brightness adjustment on hover, with consistent z-index.",
    authors: [Devs.Aho],
    start() {
        const style = document.createElement("style");
        style.textContent = `
            .root_af8192 {
                display: flex;
                flex-wrap: nowrap;
                align-items: center;
            }
            div.role_dfa8b6.pill_dfa8b6 {
                border: 2.5px solid var(--role-color) !important;
                border-radius: 12px !important;
                box-shadow: 
                    0 0 8px var(--role-color),
                    0 0 12px var(--role-color),
                    0 0 18px var(--role-color) !important;
                background: #181828e6 !important;
                color: #fff !important;
                font-weight: 700 !important;
                font-size: 13.5px !important;
                padding: 3px 7px !important;
                margin-bottom: 5px !important;
                letter-spacing: 0.01em;
                filter: brightness(0.9);
                transition: border-color 0.13s, box-shadow 0.13s, filter 0.13s;
                text-align: center;
                display: inline-flex !important;
                align-items: center;
            }
            div.role_dfa8b6.pill_dfa8b6:hover {
                filter: brightness(1.15);
            }
            div.role_dfa8b6.pill_dfa8b6:last-child {
                margin-right: 0 !important;
            }
        `;
        document.head.appendChild(style);

        const syncColors = () => {
            document.querySelectorAll(".role_dfa8b6.pill_dfa8b6").forEach(pill => {
                const roleColor = pill.querySelector(".roleCircle_dfa8b6")?.style.backgroundColor;
                if (roleColor) {
                    pill.style.setProperty("--role-color", roleColor);
                }
            });
        };

        syncColors();
        const observer = new MutationObserver(syncColors);
        observer.observe(document.body, { childList: true, subtree: true });

        this.style = style;
        this.observer = observer;
    },
    stop() {
        this.style?.remove();
        this.observer?.disconnect();
    }
});