/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CspPolicies } from "@main/csp";

CspPolicies["p.scdn.co"] = ["media-src"];
CspPolicies["i.scdn.co"] = ["connect-src"];
