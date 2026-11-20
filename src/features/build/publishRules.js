// Pure rule for the "Ready to publish" button (unit tested): a finished build job with saved checkpoints that
// has not already been requested or deployed.
export const canPublish = (job) => !!(job?.build?.ready_to_publish && (job.build.checkpoints || []).length && ["needs_review", "needs_approval", "approved", "done"].includes(job.status) && !["requested", "deploying", "deployed"].includes(job.publish?.status));
