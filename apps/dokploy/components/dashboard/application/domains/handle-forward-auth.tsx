import { ShieldCheck } from "lucide-react";
import { useState } from "react";
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
import { api } from "@/utils/api";

interface Props {
	domainId: string;
	host: string;
	applicationId: string;
	forwardAuthEnabled: boolean;
}

// SSO forward-auth can no longer be configured, but domains that already have it stay protected
// until an admin turns it off here.
export const HandleForwardAuth = ({
	domainId,
	host,
	applicationId,
	forwardAuthEnabled,
}: Props) => {
	const [isOpen, setIsOpen] = useState(false);
	const utils = api.useUtils();
	const { mutateAsync, isPending } = api.domain.update.useMutation();

	if (!forwardAuthEnabled) {
		return null;
	}

	const handleDisable = async () => {
		try {
			await mutateAsync({ domainId, host, forwardAuthEnabled: false });
			toast.success("SSO authentication disabled for this domain");
			await utils.domain.byApplicationId.invalidate({ applicationId });
			await utils.application.readTraefikConfig.invalidate({ applicationId });
			setIsOpen(false);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Error disabling SSO authentication",
			);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="group hover:bg-emerald-500/10"
					title="SSO authentication"
				>
					<ShieldCheck className="size-4 text-emerald-500" />
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>SSO Authentication</DialogTitle>
					<DialogDescription>
						This domain requires visitors to authenticate through the SSO
						authentication proxy.
					</DialogDescription>
				</DialogHeader>
				<AlertBlock type="warning">
					SSO configuration is not available in this version. Disabling the
					protection makes the domain publicly accessible.
				</AlertBlock>
				<DialogFooter>
					<Button variant="outline" onClick={() => setIsOpen(false)}>
						Close
					</Button>
					<Button
						variant="destructive"
						isLoading={isPending}
						onClick={handleDisable}
					>
						Disable protection
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
