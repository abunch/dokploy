import type { whitelabelingConfigSchema } from "@dokploy/server/db/schema";
import type { z } from "zod";

type WhitelabelingConfig = z.infer<typeof whitelabelingConfigSchema>;

// Whitelabeling is not available in this build; callers fall back to default branding.
export function useWhitelabeling(): { config: WhitelabelingConfig | null } {
	return { config: null };
}

export function useWhitelabelingPublic(): {
	config: WhitelabelingConfig | null;
} {
	return { config: null };
}
