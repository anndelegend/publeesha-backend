async function publishToPlatform(platform, post){
  // Replace these stubs with real platform APIs after app approvals and keys are ready.
  return { success: true, platform, externalPostId: `demo-${platform}-${Date.now()}`, url: `https://publeesha.local/${platform}/${post.id}` };
}
module.exports = { publishToPlatform };
