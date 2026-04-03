import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "client", "src", "pages", "publish-center-page.tsx");
const lines = fs.readFileSync(src, "utf8").split(/\r?\n/);
const body = lines.slice(330, 826).join("\n");

const header = `import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type {
  PublishDraft,
  AssetPackage,
  AssetVersion,
  AssetGroup,
  PublishTemplate,
  AssetAspectRatio,
  AudienceStrategy,
  PlacementStrategy,
} from "@shared/schema";
import {
  audienceStrategyLabels,
  placementStrategies,
  audienceStrategies,
} from "@shared/schema";
import { generateSOPNames } from "@shared/auto-naming";
import { appendUtmToLandingUrl } from "@shared/utm-inject";
import { OBJECTIVE_TO_PREFIX, META_CTA_OPTIONS } from "./publish-constants";
import { publishFetch, type SyncedResponse } from "./publish-api";
import {
  draftToForm,
  formToBody,
  getPublishUrlParams,
  getVersionGroupInfo,
} from "./publish-helpers";
import { emptyForm, type FormState, type BatchGroupByAsset } from "./publish-types";

export function usePublishWorkbench() {
`;

const out = path.join(root, "client", "src", "pages", "publish", "usePublishWorkbench.ts");
fs.writeFileSync(out, header + body + "\n}\n");
console.log("Wrote", out, "lines", (header + body + "\n}\n").split("\n").length);
