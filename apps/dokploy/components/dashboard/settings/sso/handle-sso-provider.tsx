import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, type RouterOutputs } from "@/utils/api";

type Provider = RouterOutputs["forkSso"]["listProviders"][number];
type MappedRole = "admin" | "member";

const parseMappings = (text: string) => {
	const mappings: { group: string; role: MappedRole }[] = [];
	for (const [index, raw] of text.split("\n").entries()) {
		const line = raw.trim();
		if (!line) continue;
		const [group, role] = line.split("=").map((part) => part.trim());
		if (!group || (role !== "admin" && role !== "member")) {
			throw new Error(
				`Line ${index + 1}: use "group = admin" or "group = member"`,
			);
		}
		mappings.push({ group, role });
	}
	return mappings;
};

const formatMappings = (mappings: { group: string; role: string }[]) =>
	mappings.map((m) => `${m.group} = ${m.role}`).join("\n");

interface Props {
	provider?: Provider;
	children: React.ReactNode;
}

export const HandleSsoProvider = ({ provider, children }: Props) => {
	const utils = api.useUtils();
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [providerId, setProviderId] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [issuer, setIssuer] = useState("");
	const [clientId, setClientId] = useState("");
	const [clientSecret, setClientSecret] = useState("");
	const [domains, setDomains] = useState("");
	const [groupsClaim, setGroupsClaim] = useState("groups");
	const [mappings, setMappings] = useState("");
	const [defaultRole, setDefaultRole] = useState<MappedRole>("member");
	const [requireMappedGroup, setRequireMappedGroup] = useState(false);

	const create = api.forkSso.createProvider.useMutation();
	const update = api.forkSso.updateProvider.useMutation();
	const isEdit = Boolean(provider);

	useEffect(() => {
		if (!open) return;
		setError(null);
		setProviderId(provider?.providerId ?? "");
		setDisplayName(provider?.displayName ?? "");
		setIssuer(provider?.issuer ?? "");
		setClientId(provider?.clientId ?? "");
		setClientSecret("");
		setDomains(provider?.domains.join(", ") ?? "");
		setGroupsClaim(provider?.settings.groupsClaim ?? "groups");
		setMappings(formatMappings(provider?.settings.roleMappings ?? []));
		setDefaultRole(provider?.settings.defaultRole ?? "member");
		setRequireMappedGroup(provider?.settings.requireMappedGroup ?? false);
	}, [open, provider]);

	const callbackUrl =
		typeof window !== "undefined" && providerId
			? `${window.location.origin}/api/auth/sso/callback/${providerId}`
			: "";

	const onSave = async () => {
		setError(null);
		try {
			const settings = {
				displayName: displayName.trim() || undefined,
				groupsClaim: groupsClaim.trim() || "groups",
				roleMappings: parseMappings(mappings),
				defaultRole,
				requireMappedGroup,
			};
			const domainList = domains
				.split(/[,\s]+/)
				.map((d) => d.trim())
				.filter(Boolean);
			if (isEdit) {
				await update.mutateAsync({
					providerId,
					clientId,
					clientSecret: clientSecret || undefined,
					domains: domainList,
					settings,
				});
				toast.success("SSO provider updated");
			} else {
				const { enabled } = await create.mutateAsync({
					providerId,
					issuer,
					clientId,
					clientSecret,
					domains: domainList,
					settings,
				});
				if (enabled) {
					toast.success("SSO provider added");
				} else {
					toast.info(
						"Added as inactive because an active provider already covers these domains. Use Make active to switch.",
					);
				}
			}
			await utils.forkSso.listProviders.invalidate();
			setOpen(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not save");
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{isEdit ? "Edit SSO provider" : "Add SSO provider"}
					</DialogTitle>
					<DialogDescription>
						Works with any OpenID Connect provider, such as Authentik, Auth0,
						Okta, Keycloak or Microsoft Entra ID.
					</DialogDescription>
				</DialogHeader>

				{error && <AlertBlock type="error">{error}</AlertBlock>}

				<div className="grid gap-4">
					<div className="grid gap-2">
						<Label htmlFor="sso-provider-id">Provider ID</Label>
						<Input
							id="sso-provider-id"
							placeholder="authentik"
							value={providerId}
							disabled={isEdit}
							onChange={(e) => setProviderId(e.target.value.toLowerCase())}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="sso-display-name">Button label</Label>
						<Input
							id="sso-display-name"
							placeholder="Company SSO"
							maxLength={50}
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							Shown on the sign-in page as "Sign in with …". Anyone who opens
							the sign-in page can see it.
						</p>
					</div>
					{callbackUrl && (
						<div className="grid gap-2">
							<Label>Redirect URI to register in your identity provider</Label>
							<Input readOnly value={callbackUrl} className="font-mono" />
						</div>
					)}
					<div className="grid gap-2">
						<Label htmlFor="sso-issuer">Issuer URL</Label>
						<Input
							id="sso-issuer"
							placeholder="https://auth.example.com/application/o/platform/"
							value={issuer}
							disabled={isEdit}
							onChange={(e) => setIssuer(e.target.value)}
						/>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="grid gap-2">
							<Label htmlFor="sso-client-id">Client ID</Label>
							<Input
								id="sso-client-id"
								value={clientId}
								onChange={(e) => setClientId(e.target.value)}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="sso-client-secret">Client secret</Label>
							<Input
								id="sso-client-secret"
								type="password"
								placeholder={
									isEdit ? "Leave empty to keep the current secret" : ""
								}
								value={clientSecret}
								onChange={(e) => setClientSecret(e.target.value)}
							/>
						</div>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="sso-domains">Email domains</Label>
						<Input
							id="sso-domains"
							placeholder="example.com, example.org"
							value={domains}
							onChange={(e) => setDomains(e.target.value)}
						/>
					</div>

					<div className="grid gap-2 border-t pt-4">
						<Label htmlFor="sso-mappings">Group → role mappings</Label>
						<Textarea
							id="sso-mappings"
							rows={4}
							placeholder={"platform-admins = admin\ndevelopers = member"}
							value={mappings}
							onChange={(e) => setMappings(e.target.value)}
							className="font-mono"
						/>
						<p className="text-xs text-muted-foreground">
							One per line. Roles are set from these groups at every SSO
							sign-in. The highest matching role wins; the owner is never
							changed.
						</p>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="grid gap-2">
							<Label htmlFor="sso-groups-claim">Groups claim</Label>
							<Input
								id="sso-groups-claim"
								value={groupsClaim}
								onChange={(e) => setGroupsClaim(e.target.value)}
							/>
						</div>
						<div className="grid gap-2">
							<Label>Role when no group matches</Label>
							<Select
								value={defaultRole}
								onValueChange={(value) => setDefaultRole(value as MappedRole)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="member">Member</SelectItem>
									<SelectItem value="admin">Admin</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<div className="flex items-center justify-between rounded-lg border p-3">
						<div>
							<Label htmlFor="sso-require-group">Require a mapped group</Label>
							<p className="text-xs text-muted-foreground">
								Refuse sign-in, and remove access, for people in none of the
								groups above.
							</p>
						</div>
						<Switch
							id="sso-require-group"
							checked={requireMappedGroup}
							onCheckedChange={setRequireMappedGroup}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button
						onClick={onSave}
						isLoading={create.isPending || update.isPending}
					>
						{isEdit ? "Save" : "Add provider"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
