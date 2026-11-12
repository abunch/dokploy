import { deleteUserAccountData, findUserById } from "@dokploy/server";

export const deleteAccount = async (
	userId: string,
	requestedBy: string,
	options?: { requestedAt?: Date | null },
) => {
	const target = await findUserById(userId);
	const startedAt = new Date().toISOString();

	const { organizationsDeleted } = await deleteUserAccountData(userId);

	const record = {
		userId,
		email: target.email,
		requestedBy,
		requestedAt: options?.requestedAt?.toISOString() ?? startedAt,
		startedAt,
		completedAt: new Date().toISOString(),
		organizationsDeleted,
	};

	return record;
};
