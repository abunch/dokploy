import {
	CLEANUP_CRON_JOB,
	cleanupAll,
	sendDockerCleanupNotifications,
} from "@dokploy/server";
import { scheduledJobs, scheduleJob } from "node-schedule";

export const applyDockerCleanupSchedule = async (
	serverId: string,
	organizationId: string,
	enable: boolean,
) => {
	if (enable) {
		scheduleJob(serverId, CLEANUP_CRON_JOB, async () => {
			await cleanupAll(serverId);
			await sendDockerCleanupNotifications(organizationId);
		});
	} else {
		scheduledJobs[serverId]?.cancel();
	}
};
