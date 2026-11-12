const originOf = (url: string | undefined) => {
	if (!url) return null;
	try {
		return new URL(url).origin;
	} catch {
		return null;
	}
};

export const buildContentSecurityPolicy = ({
	dev,
	templatesUrl,
}: {
	dev: boolean;
	templatesUrl?: string;
}) => {
	const templatesOrigin = originOf(templatesUrl);
	const scriptSrc = ["'self'", "'unsafe-inline'"];
	// Next.js hot reload evaluates code in development only.
	if (dev) scriptSrc.push("'unsafe-eval'");

	const imgSrc = ["'self'", "data:", "blob:"];
	// Template logos are served by the operator's own catalog.
	if (templatesOrigin) imgSrc.push(templatesOrigin);

	return [
		"default-src 'self'",
		`script-src ${scriptSrc.join(" ")}`,
		"style-src 'self' 'unsafe-inline'",
		`img-src ${imgSrc.join(" ")}`,
		"font-src 'self' data:",
		"connect-src 'self'",
		"worker-src 'self' blob:",
		"frame-ancestors 'none'",
		"base-uri 'self'",
		"object-src 'none'",
		// Creating a GitHub App posts a manifest form to GitHub or a GitHub Enterprise host.
		"form-action 'self' https:",
	].join("; ");
};
