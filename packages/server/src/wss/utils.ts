import os from "node:os";
import path from "node:path";
import { paths } from "@dokploy/server/constants";

export const getShell = () => {
	switch (os.platform()) {
		case "win32":
			return "powershell.exe";
		case "darwin":
			return "zsh";
		default:
			return "bash";
	}
};

export const readValidDirectory = (
	directory: string,
	serverId?: string | null,
) => {
	if (!/^[\w/. :[\]+@~(),=%-]{1,500}$/.test(directory)) {
		return false;
	}

	const { BASE_PATH } = paths(!!serverId);

	const resolvedBase = path.resolve(BASE_PATH);
	const resolvedDir = path.resolve(directory);

	return (
		resolvedDir === resolvedBase ||
		resolvedDir.startsWith(resolvedBase + path.sep)
	);
};
