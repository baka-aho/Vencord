/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findByCodeLazy } from "@webpack";
import type { FC } from "react";

export const enum SpinnerType {
    SpinningCircle = "spinningCircle",
    SpinningCircleSimple = "spinningCircleSimple",
    ChasingDots = "chasingDots",
    LowMotion = "lowMotion",
    PulsingEllipsis = "pulsingEllipsis",
    WanderingCubes = "wanderingCubes",
}

export interface SpinnerProps {
    type: SpinnerType;
    animated?: boolean;
    className?: string;
    itemClassName?: string;
}

export const Spinner: FC<SpinnerProps> = findByCodeLazy("\"spinningCircle\"===");
