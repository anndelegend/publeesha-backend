const plans = {
  free: { name: 'Free', accountLimit: 3, scheduledPosts: 20, teamMembers: 1 },
  creator: { name: 'Creator', accountLimit: 10, scheduledPosts: 150, teamMembers: 1 },
  business: { name: 'Business', accountLimit: 30, scheduledPosts: 1000, teamMembers: 10 },
  agency: { name: 'Agency', accountLimit: 999999, scheduledPosts: 999999, teamMembers: 999999 }
};
function getPlan(plan){ return plans[plan] || plans.free; }
module.exports = { plans, getPlan };
