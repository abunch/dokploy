#!/usr/bin/env node
// End-to-end SSO check against the local Authentik in dev/authentik (feature 003).
// Requires: the platform on PLATFORM_URL with an "authentik" provider for dokploy.test that maps
// dokploy-admins → admin, and the Authentik fixture users.
const PLATFORM_URL = process.env.PLATFORM_URL ?? "http://localhost:3000";

class Jar {
	cookies = new Map();
	store(response) {
		for (const header of response.headers.getSetCookie?.() ?? []) {
			const [pair] = header.split(";");
			const index = pair.indexOf("=");
			this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1));
		}
	}
	header() {
		return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
	}
	get(name) {
		return this.cookies.get(name);
	}
}

const request = async (jar, url, init = {}) => {
	const response = await fetch(url, {
		...init,
		redirect: "manual",
		headers: { ...(init.headers ?? {}), cookie: jar.header() },
	});
	jar.store(response);
	return response;
};

const follow = async (jar, url) => {
	let current = url;
	for (let hop = 0; hop < 10; hop++) {
		const response = await request(jar, current);
		const location = response.headers.get("location");
		if (!location) return { response, url: current };
		current = new URL(location, current).toString();
		if (current.startsWith(PLATFORM_URL)) return { response, url: current };
	}
	throw new Error(`Too many redirects from ${url}`);
};

const authentikLogin = async (jar, authorizeUrl, username, password) => {
	const { url: loginUrl } = await follow(jar, authorizeUrl);
	if (loginUrl.startsWith(PLATFORM_URL)) return loginUrl;
	const login = new URL(loginUrl);
	const slug = login.pathname.split("/").filter(Boolean).at(-1);
	const executor = `${login.origin}/api/v3/flows/executor/${slug}/?query=${encodeURIComponent(login.search.slice(1))}`;
	// The flow executor answers with redirects back to itself before returning the next stage.
	const readChallenge = async (response) => {
		let current = response;
		for (let hop = 0; hop < 5 && current.headers.get("location"); hop++) {
			current = await request(
				jar,
				new URL(current.headers.get("location"), login.origin).toString(),
			);
		}
		return current.json();
	};
	const post = async (body) =>
		readChallenge(
			await request(jar, executor, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-authentik-csrf": jar.get("authentik_csrf") ?? "",
				},
				body: JSON.stringify(body),
			}),
		);

	let challenge = await readChallenge(await request(jar, executor));
	for (let step = 0; step < 6; step++) {
		if (challenge.component === "xak-flow-redirect") {
			const { url } = await follow(
				jar,
				new URL(challenge.to, login.origin).toString(),
			);
			return url;
		}
		if (challenge.component === "ak-stage-identification") {
			challenge = await post({
				component: challenge.component,
				uid_field: username,
				...(challenge.password_fields ? { password } : {}),
			});
		} else if (challenge.component === "ak-stage-password") {
			challenge = await post({ component: challenge.component, password });
		} else {
			throw new Error(`Unexpected Authentik stage ${challenge.component}`);
		}
		if (challenge.response_errors) {
			throw new Error(JSON.stringify(challenge.response_errors));
		}
	}
	throw new Error("Authentik login did not finish");
};

const ZITADEL_URL = process.env.ZITADEL_URL ?? "http://localhost:8085";

const formFields = (html) => {
	const action = html.match(/<form[^>]*action="([^"]+)"/)?.[1];
	const fields = {};
	for (const input of html.matchAll(/<input[^>]*>/g)) {
		const name = input[0].match(/name="([^"]+)"/)?.[1];
		const value = input[0].match(/value="([^"]*)"/)?.[1] ?? "";
		if (name)
			fields[name] = value.replaceAll("&#43;", "+").replaceAll("&amp;", "&");
	}
	return { action, fields };
};

// Drives Zitadel's classic login pages: login name, password, then the optional MFA prompt.
const zitadelLogin = async (jar, authorizeUrl, username, password) => {
	let { response, url } = await follow(jar, authorizeUrl);
	for (let step = 0; step < 8; step++) {
		if (url.startsWith(PLATFORM_URL)) return url;
		const html = await response.text();
		const { action, fields } = formFields(html);
		if (!action) throw new Error(`No form on Zitadel page ${url}`);
		if (action.includes("loginname")) fields.loginName = username;
		else if (action.includes("password")) fields.password = password;
		else if (action.includes("mfa/prompt")) fields.skip = "true";
		else throw new Error(`Unexpected Zitadel page ${action}`);
		const posted = await request(jar, new URL(action, ZITADEL_URL).toString(), {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams(fields).toString(),
		});
		const location = posted.headers.get("location");
		if (location) {
			({ response, url } = await follow(
				jar,
				new URL(location, ZITADEL_URL).toString(),
			));
		} else {
			response = posted;
		}
	}
	throw new Error("Zitadel login did not finish");
};

// Starts from the email (domain routing) or, with providerId, the way a sign-in button does.
const signInWithSso = async (email, username, password, providerId) => {
	const jar = new Jar();
	const start = await request(jar, `${PLATFORM_URL}/api/auth/sign-in/sso`, {
		method: "POST",
		headers: { "content-type": "application/json", origin: PLATFORM_URL },
		body: JSON.stringify({
			...(providerId ? { providerId } : { email }),
			callbackURL: "/dashboard/home",
		}),
	});
	const body = await start.json();
	if (!body.url) throw new Error(`SSO start failed: ${JSON.stringify(body)}`);

	const login =
		new URL(body.url).origin === new URL(ZITADEL_URL).origin
			? zitadelLogin
			: authentikLogin;
	const callbackUrl = await login(jar, body.url, username, password);
	const callback = await request(jar, callbackUrl);
	const landed = callback.headers.get("location") ?? "";
	return { jar, landed };
};

const trpc = async (jar, procedure) => {
	const response = await request(jar, `${PLATFORM_URL}/api/trpc/${procedure}`);
	return (await response.json()).result?.data?.json;
};

const passwordSignIn = async (email, password) => {
	const response = await fetch(`${PLATFORM_URL}/api/auth/sign-in/email`, {
		method: "POST",
		headers: { "content-type": "application/json", origin: PLATFORM_URL },
		body: JSON.stringify({ email, password }),
	});
	return response.status;
};

const results = [];
const check = (name, ok, detail = "") => {
	results.push(ok);
	console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};

const users = [
	["alice@dokploy.test", "alice", "alice-dev-password", "admin"],
	["bob@dokploy.test", "bob", "bob-dev-password", "member"],
	["carol@dokploy.test", "carol", "carol-dev-password", "member"],
];

for (const [email, username, password, expectedRole] of users) {
	try {
		const { jar, landed } = await signInWithSso(email, username, password);
		const member = await trpc(jar, "user.get");
		check(
			`${username} signs in with SSO as ${expectedRole}`,
			landed.includes("/dashboard") && member?.role === expectedRole,
			`landed ${landed}, role ${member?.role}`,
		);
	} catch (error) {
		check(`${username} signs in with SSO`, false, error.message);
	}
}

{
	const { jar, landed } = await signInWithSso(
		undefined,
		"bob",
		"bob-dev-password",
		"authentik",
	);
	const member = await trpc(jar, "user.get");
	check(
		"one-click sign-in by provider (no email) works",
		landed.includes("/dashboard") && member?.user?.email === "bob@dokploy.test",
		`landed ${landed}`,
	);
}

const AUTHENTIK_URL = process.env.AUTHENTIK_URL ?? "http://localhost:9000";
const AUTHENTIK_TOKEN = process.env.AUTHENTIK_TOKEN ?? "dokploy-dev-api-token";

const authentik = async (path, init = {}) => {
	const response = await fetch(`${AUTHENTIK_URL}/api/v3${path}`, {
		...init,
		headers: {
			authorization: `Bearer ${AUTHENTIK_TOKEN}`,
			"content-type": "application/json",
			...(init.headers ?? {}),
		},
	});
	return response.status === 204 ? null : response.json();
};

const setAliceAdmin = async (isAdmin) => {
	const [group] = (await authentik("/core/groups/?name=dokploy-admins"))
		.results;
	const [alice] = (await authentik("/core/users/?username=alice")).results;
	await authentik(
		`/core/groups/${group.pk}/${isAdmin ? "add_user" : "remove_user"}/`,
		{ method: "POST", body: JSON.stringify({ pk: alice.pk }) },
	);
};

const roleAfterSignIn = async (email, username, password) => {
	const { jar } = await signInWithSso(email, username, password);
	return (await trpc(jar, "user.get"))?.role;
};

try {
	await setAliceAdmin(false);
	const lowered = await roleAfterSignIn(
		"alice@dokploy.test",
		"alice",
		"alice-dev-password",
	);
	check(
		"alice is lowered to member after leaving the admin group",
		lowered === "member",
		`role ${lowered}`,
	);
} finally {
	await setAliceAdmin(true);
}
const restored = await roleAfterSignIn(
	"alice@dokploy.test",
	"alice",
	"alice-dev-password",
);
check(
	"alice is admin again after rejoining the group",
	restored === "admin",
	`role ${restored}`,
);

const ownerEmail = process.env.OWNER_EMAIL;
const ownerPassword = process.env.OWNER_PASSWORD;
if (ownerEmail && ownerPassword) {
	const ownerJar = new Jar();
	const signIn = await request(
		ownerJar,
		`${PLATFORM_URL}/api/auth/sign-in/email`,
		{
			method: "POST",
			headers: { "content-type": "application/json", origin: PLATFORM_URL },
			body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
		},
	);
	check(
		"owner signs in with a password",
		signIn.status === 200,
		`HTTP ${signIn.status}`,
	);
	const setSsoOnly = (enabled) =>
		request(ownerJar, `${PLATFORM_URL}/api/trpc/forkSso.setSsoOnly`, {
			method: "POST",
			headers: { "content-type": "application/json", origin: PLATFORM_URL },
			body: JSON.stringify({ json: { enabled } }),
		});
	const updateSettings = (requireMappedGroup) =>
		request(ownerJar, `${PLATFORM_URL}/api/trpc/forkSso.updateProvider`, {
			method: "POST",
			headers: { "content-type": "application/json", origin: PLATFORM_URL },
			body: JSON.stringify({
				json: {
					providerId: "authentik",
					settings: {
						groupsClaim: "groups",
						roleMappings: [
							{ group: "dokploy-admins", role: "admin" },
							{ group: "dokploy-developers", role: "member" },
						],
						defaultRole: "member",
						requireMappedGroup,
					},
				},
			}),
		});
	try {
		await updateSettings(true);
		const carol = await signInWithSso(
			"carol@dokploy.test",
			"carol",
			"carol-dev-password",
		);
		const carolMember = await trpc(carol.jar, "user.get");
		check(
			"user in no mapped group is refused when a mapped group is required",
			carol.landed.includes("error=sso_not_allowed") && !carolMember,
			`landed ${carol.landed}`,
		);
		const bobRole = await roleAfterSignIn(
			"bob@dokploy.test",
			"bob",
			"bob-dev-password",
		);
		check(
			"user in a mapped group still signs in",
			bobRole === "member",
			`role ${bobRole}`,
		);
	} finally {
		await updateSettings(false);
	}
	try {
		const enabled = await setSsoOnly(true);
		check(
			"owner turns on SSO-only",
			enabled.status === 200,
			`HTTP ${enabled.status}`,
		);
		const bob = await passwordSignIn("bob@dokploy.test", "anything-at-all");
		check(
			"non-owner password sign-in refused while SSO is required",
			bob === 403,
			`HTTP ${bob}`,
		);
		const signUp = await fetch(`${PLATFORM_URL}/api/auth/sign-up/email`, {
			method: "POST",
			headers: { "content-type": "application/json", origin: PLATFORM_URL },
			body: JSON.stringify({
				email: "new@dokploy.test",
				password: "a-long-password",
				name: "New",
			}),
		});
		check(
			"sign-up refused while SSO is required",
			signUp.status === 403,
			`HTTP ${signUp.status}`,
		);
		const owner = await passwordSignIn(ownerEmail, ownerPassword);
		check(
			"owner break-glass password sign-in still works",
			owner === 200,
			`HTTP ${owner}`,
		);
		const sso = await roleAfterSignIn(
			"bob@dokploy.test",
			"bob",
			"bob-dev-password",
		);
		check(
			"SSO sign-in works while SSO is required",
			sso === "member",
			`role ${sso}`,
		);
	} finally {
		await setSsoOnly(false);
	}
}

if (process.env.ZITADEL_SWAP === "1" && ownerEmail && ownerPassword) {
	const ownerJar = new Jar();
	await request(ownerJar, `${PLATFORM_URL}/api/auth/sign-in/email`, {
		method: "POST",
		headers: { "content-type": "application/json", origin: PLATFORM_URL },
		body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
	});
	const setActive = async (providerId) => {
		const response = await request(
			ownerJar,
			`${PLATFORM_URL}/api/trpc/forkSso.setProviderActive`,
			{
				method: "POST",
				headers: { "content-type": "application/json", origin: PLATFORM_URL },
				body: JSON.stringify({ json: { providerId, active: true } }),
			},
		);
		return (await response.json()).result?.data?.json;
	};
	const startStatus = async (providerId) =>
		(
			await fetch(`${PLATFORM_URL}/api/auth/sign-in/sso`, {
				method: "POST",
				headers: { "content-type": "application/json", origin: PLATFORM_URL },
				body: JSON.stringify({ providerId, callbackURL: "/dashboard/home" }),
			})
		).status;
	const whoAmI = async (email, username, password, providerId) => {
		const { jar } = await signInWithSso(email, username, password, providerId);
		return trpc(jar, "user.get");
	};

	const before = await whoAmI(
		"alice@dokploy.test",
		"alice",
		"alice-dev-password",
	);
	check(
		"staged Zitadel cannot be used while inactive",
		(await startStatus("zitadel")) === 404,
	);

	const swap = await setActive("zitadel");
	check(
		"making Zitadel active deactivates Authentik in one step",
		swap?.deactivated?.includes("authentik"),
		JSON.stringify(swap),
	);
	check(
		"Authentik cannot be used once inactive",
		(await startStatus("authentik")) === 404,
	);

	const alice = await whoAmI(
		"alice@dokploy.test",
		"alice",
		"alice-zitadel-dev-Password1!",
		"zitadel",
	);
	check(
		"alice signs in through Zitadel as admin from Zitadel's role object",
		alice?.role === "admin",
		`role ${alice?.role}`,
	);
	check(
		"alice keeps the same Dokploy account after the switch",
		alice?.userId === before?.userId,
		`${before?.userId} → ${alice?.userId}`,
	);
	const bob = await whoAmI(
		"bob@dokploy.test",
		"bob",
		"bob-zitadel-dev-Password1!",
		"zitadel",
	);
	check(
		"bob signs in through Zitadel as member",
		bob?.role === "member",
		`role ${bob?.role}`,
	);

	const viaEmail = await whoAmI(
		"bob@dokploy.test",
		"bob",
		"bob-zitadel-dev-Password1!",
	);
	check(
		"email routing picks the active provider (Zitadel)",
		viaEmail?.role === "member",
	);

	const back = await setActive("authentik");
	check(
		"switching back to Authentik works",
		back?.deactivated?.includes("zitadel"),
	);
}

process.exit(results.every(Boolean) ? 0 : 1);
