/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

import Boo from "./components/Boo";
import { BooProps } from "./types";

export default definePlugin({
    name: "Boo",
    description: "Shows a ghost if you haven't responded to someone's DM",
    authors: [Devs.Mickey],
    patches: [
        {
            find: "interactiveSelected]",
            replacement: {
                match: /interactiveSelected.{0,50}children:\[/,
                replace: "$&$self.renderBoo(arguments[0]),"
            }
        }
    ],

    renderBoo: (props: BooProps) => {
        return (
            <ErrorBoundary noop>
                <Boo {...props} />
            </ErrorBoundary>
        );
    }
});
