#!/usr/bin/env node
// Configures the local Zitadel from dev/zitadel for SSO tests: a Dokploy project with roles, an OIDC
// app and test users. Prints the client credentials as JSON. Usage: node dev/zitadel/setup.mjs <pat>
const ZITADEL_URL = process.env.ZITADEL_URL ?? "http://localhost:8085";
const PLATFORM_URL = process.env.PLATFORM_URL ?? "http://localhost:3000";
const pat = process.argv[2];
if (!pat) {
	console.error("usage: node dev/zitadel/setup.mjs <personal access token>");
	process.exit(2);
}

const api = async (method, path, body) => {
	const response = await fetch(`${ZITADEL_URL}${path}`, {
		method,
		headers: {
			authorization: `Bearer ${pat}`,
			"content-type": "application/json",
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const data = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(
			`${method} ${path}: ${response.status} ${JSON.stringify(data)}`,
		);
	}
	return data;
};

const project = await api("POST", "/management/v1/projects", {
	name: `Dokploy ${Date.now()}`,
	projectRoleAssertion: true,
});

await api("POST", `/management/v1/projects/${project.id}/roles/_bulk`, {
	roles: [
		{ key: "dokploy-admins", displayName: "Dokploy admins" },
		{ key: "developers", displayName: "Developers" },
	],
});

const app = await api(
	"POST",
	`/management/v1/projects/${project.id}/apps/oidc`,
	{
		name: "Dokploy",
		redirectUris: [`${PLATFORM_URL}/api/auth/sso/callback/zitadel`],
		responseTypes: ["OIDC_RESPONSE_TYPE_CODE"],
		grantTypes: ["OIDC_GRANT_TYPE_AUTHORIZATION_CODE"],
		appType: "OIDC_APP_TYPE_WEB",
		authMethodType: "OIDC_AUTH_METHOD_TYPE_BASIC",
		devMode: true,
		idTokenRoleAssertion: true,
		idTokenUserinfoAssertion: true,
		accessTokenRoleAssertion: true,
	},
);

// Never prompt test users to enrol a second factor.
await api("POST", "/management/v1/policies/login", {
	allowUsernamePassword: true,
	allowRegister: false,
	allowExternalIdp: false,
	forceMfa: false,
	passwordlessType: "PASSWORDLESS_TYPE_NOT_ALLOWED",
	mfaInitSkipLifetime: "0s",
	secondFactorCheckLifetime: "64800s",
	multiFactorCheckLifetime: "43200s",
	passwordCheckLifetime: "864000s",
	externalLoginCheckLifetime: "864000s",
}).catch(() =>
	api("PUT", "/management/v1/policies/login", {
		allowUsernamePassword: true,
		allowRegister: false,
		allowExternalIdp: false,
		forceMfa: false,
		passwordlessType: "PASSWORDLESS_TYPE_NOT_ALLOWED",
		mfaInitSkipLifetime: "0s",
		secondFactorCheckLifetime: "64800s",
		multiFactorCheckLifetime: "43200s",
		passwordCheckLifetime: "864000s",
		externalLoginCheckLifetime: "864000s",
	}),
);

const users = [
	["alice", "Alice", "Admin", "alice@dokploy.test", ["dokploy-admins"]],
	["bob", "Bob", "Developer", "bob@dokploy.test", ["developers"]],
];

for (const [userName, firstName, lastName, email, roleKeys] of users) {
	const existing = await api("POST", "/management/v1/users/_search", {
		queries: [
			{ userNameQuery: { userName, method: "TEXT_QUERY_METHOD_EQUALS" } },
		],
	});
	const userId =
		existing.result?.[0]?.id ??
		(
			await api("POST", "/management/v1/users/human/_import", {
				userName,
				profile: { firstName, lastName },
				email: { email, isEmailVerified: true },
				password: `${userName}-zitadel-dev-Password1!`,
				passwordChangeRequired: false,
			})
		).userId;
	await api("POST", `/management/v1/users/${userId}/grants`, {
		projectId: project.id,
		roleKeys,
	});
}

console.log(
	JSON.stringify({
		issuer: ZITADEL_URL,
		clientId: app.clientId,
		clientSecret: app.clientSecret,
		projectId: project.id,
	}),
);
