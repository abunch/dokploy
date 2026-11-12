import NextDocument, {
	type DocumentContext,
	type DocumentInitialProps,
	Head,
	Html,
	Main,
	NextScript,
} from "next/document";

interface WhitelabelingDocumentProps {
	appName: string | null;
	appDescription: string | null;
	ogImageUrl: string | null;
	faviconHref: string | null;
	faviconLightHref: string | null;
	customCss: string | null;
	baseUrl: string;
}

export default function Document({
	appName,
	appDescription,
	ogImageUrl,
	faviconHref,
	faviconLightHref,
	customCss,
	baseUrl,
}: WhitelabelingDocumentProps) {
	const title = appName || "Dokploy";
	const description =
		appDescription || "The Open Source alternative to Netlify, Vercel, Heroku.";

	let ogImage = ogImageUrl || "/og.png";
	if (ogImage.startsWith("/")) {
		ogImage = `${baseUrl}${ogImage}`;
	}

	return (
		<Html lang="en" className="font-sans">
			<Head>
				{/* Rendered on the server so the correct branding is present on first
				    paint (and for social scrapers), avoiding a flash of / fallback to
				    the default Dokploy branding. */}
				<title>{title}</title>
				<meta property="og:title" content={title} />
				<meta property="og:description" content={description} />
				<meta property="og:image" content={ogImage} />
				{faviconLightHref ? (
					<>
						<link
							rel="icon"
							href={faviconHref || "/icon.svg"}
							media="(prefers-color-scheme: dark)"
						/>
						<link
							rel="icon"
							href={faviconLightHref}
							media="(prefers-color-scheme: light)"
						/>
					</>
				) : (
					<link rel="icon" href={faviconHref || "/icon.svg"} />
				)}
				{customCss && (
					<style
						id="whitelabeling-styles"
						dangerouslySetInnerHTML={{ __html: customCss }}
					/>
				)}
			</Head>
			<body className="flex h-full w-full flex-col font-sans">
				<Main />
				<NextScript />
			</body>
		</Html>
	);
}

Document.getInitialProps = async (
	ctx: DocumentContext,
): Promise<DocumentInitialProps & WhitelabelingDocumentProps> => {
	const initialProps = await NextDocument.getInitialProps(ctx);
	const host = ctx.req?.headers?.host || "localhost:3000";
	const protocol = ctx.req?.headers?.["x-forwarded-proto"] || "http";

	return {
		...initialProps,
		appName: null,
		appDescription: null,
		ogImageUrl: null,
		faviconHref: null,
		faviconLightHref: null,
		customCss: null,
		baseUrl: `${protocol}://${host}`,
	};
};
