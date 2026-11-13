import { KeyRound, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertBlock } from "@/components/shared/alert-block";
import { DialogAction } from "@/components/shared/dialog-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/utils/api";
import { HandleSsoProvider } from "./handle-sso-provider";

export const ShowSsoProviders = () => {
	const utils = api.useUtils();
	const { data: providers, isPending } = api.forkSso.listProviders.useQuery();
	const { data: ssoOnly } = api.forkSso.getSsoOnly.useQuery();
	const { data: auth } = api.user.get.useQuery();
	const remove = api.forkSso.deleteProvider.useMutation();
	const setSsoOnly = api.forkSso.setSsoOnly.useMutation();
	const isOwner = auth?.role === "owner";

	const onToggleSsoOnly = async (enabled: boolean) => {
		try {
			await setSsoOnly.mutateAsync({ enabled });
			await utils.forkSso.getSsoOnly.invalidate();
			toast.success(enabled ? "SSO is now required" : "SSO is now optional");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not update");
		}
	};

	return (
		<div className="w-full">
			<Card className="h-full bg-sidebar p-2.5 rounded-xl max-w-5xl mx-auto">
				<div className="rounded-xl bg-background shadow-md">
					<CardHeader>
						<CardTitle className="text-xl flex flex-row gap-2">
							<KeyRound className="size-6 text-muted-foreground self-center" />
							Single sign-on
						</CardTitle>
						<CardDescription>
							Let people sign in with your identity provider. Roles follow the
							groups you map below and are updated at every sign-in.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4 py-8 border-t">
						<div className="flex items-center justify-between rounded-lg border p-4">
							<div className="space-y-1">
								<Label htmlFor="sso-only">Require SSO</Label>
								<p className="text-sm text-muted-foreground">
									Everyone must sign in with SSO. Organization owners can still
									use their password so a broken identity provider cannot lock
									you out.
								</p>
							</div>
							<Switch
								id="sso-only"
								checked={ssoOnly ?? false}
								disabled={!isOwner || setSsoOnly.isPending}
								onCheckedChange={onToggleSsoOnly}
							/>
						</div>
						{!isOwner && (
							<AlertBlock type="info">
								Only the organization owner can change whether SSO is required.
							</AlertBlock>
						)}

						{isPending ? (
							<div className="flex gap-2 items-center justify-center text-sm text-muted-foreground min-h-[15vh]">
								<span>Loading...</span>
								<Loader2 className="animate-spin size-4" />
							</div>
						) : providers?.length === 0 ? (
							<div className="flex flex-col items-center gap-3 min-h-[15vh] justify-center">
								<span className="text-base text-muted-foreground">
									No identity provider is connected
								</span>
								<HandleSsoProvider>
									<Button>Add SSO provider</Button>
								</HandleSsoProvider>
							</div>
						) : (
							<div className="flex flex-col gap-3">
								{providers?.map((provider) => (
									<div
										key={provider.providerId}
										className="flex items-start justify-between gap-4 rounded-lg border p-4"
									>
										<div className="space-y-2 min-w-0">
											<div className="flex items-center gap-2">
												<span className="font-medium">
													{provider.displayName || provider.providerId}
												</span>
												{provider.domains.map((domain) => (
													<Badge key={domain} variant="secondary">
														{domain}
													</Badge>
												))}
											</div>
											<p className="text-sm text-muted-foreground truncate">
												{provider.issuer}
											</p>
											<p className="text-xs text-muted-foreground">
												{provider.settings.roleMappings.length === 0
													? `No group mappings; everyone gets ${provider.settings.defaultRole}`
													: provider.settings.roleMappings
															.map((m) => `${m.group} → ${m.role}`)
															.join(", ")}
												{provider.settings.requireMappedGroup &&
													" · mapped group required"}
											</p>
										</div>
										<div className="flex gap-1">
											<HandleSsoProvider provider={provider}>
												<Button variant="ghost" size="icon">
													<Pencil className="size-4" />
												</Button>
											</HandleSsoProvider>
											<DialogAction
												title="Delete SSO provider"
												description="People who sign in through this provider will need another way to sign in."
												type="destructive"
												onClick={async () => {
													try {
														await remove.mutateAsync({
															providerId: provider.providerId,
														});
														await utils.forkSso.listProviders.invalidate();
														toast.success("SSO provider deleted");
													} catch (error) {
														toast.error(
															error instanceof Error
																? error.message
																: "Could not delete",
														);
													}
												}}
											>
												<Button variant="ghost" size="icon">
													<Trash2 className="size-4 text-destructive" />
												</Button>
											</DialogAction>
										</div>
									</div>
								))}
								<div>
									<HandleSsoProvider>
										<Button variant="outline">Add SSO provider</Button>
									</HandleSsoProvider>
								</div>
							</div>
						)}
					</CardContent>
				</div>
			</Card>
		</div>
	);
};
