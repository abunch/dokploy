import { validateRequest } from "@dokploy/server";
import { createServerSideHelpers } from "@trpc/react-query/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import superjson from "superjson";
import { ShowSsoProviders } from "@/components/dashboard/settings/sso/show-sso-providers";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { appRouter } from "@/server/api/root";

const Page = () => {
	return (
		<div className="flex flex-col gap-4 w-full">
			<ShowSsoProviders />
		</div>
	);
};

export default Page;

Page.getLayout = (page: ReactElement) => {
	return <DashboardLayout metaName="Single sign-on">{page}</DashboardLayout>;
};

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
	const { user, session } = await validateRequest(ctx.req);
	if (!user) {
		return { redirect: { permanent: false, destination: "/" } };
	}
	const helpers = createServerSideHelpers({
		router: appRouter,
		ctx: {
			req: ctx.req as any,
			res: ctx.res as any,
			db: null as any,
			session: session as any,
			user: user as any,
		},
		transformer: superjson,
	});
	const membership = await helpers.user.get.fetch();
	if (membership?.role !== "owner") {
		return { redirect: { permanent: false, destination: "/" } };
	}
	await helpers.settings.isCloud.prefetch();
	return { props: { trpcState: helpers.dehydrate() } };
}
