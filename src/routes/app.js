const express = require('express');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { getPlan } = require('../lib/plans');
const { publishToPlatform } = require('../platforms/publishers');
const router = express.Router();
router.use(auth);
async function workspaceFor(userId){ return prisma.workspace.findFirst({where:{ownerId:userId}}); }
router.get('/dashboard', async (req,res)=>{
  const workspace = await workspaceFor(req.user.id); if(!workspace) return res.status(404).json({success:false,message:'Workspace not found'});
  const [posts, accounts, media] = await Promise.all([
    prisma.post.count({where:{workspaceId:workspace.id}}),
    prisma.socialAccount.count({where:{workspaceId:workspace.id}}),
    prisma.mediaAsset.count({where:{workspaceId:workspace.id}})
  ]);
  res.json({success:true,data:{workspace,plan:getPlan(workspace.plan),stats:{posts,accounts,media}}});
});
router.post('/upgrade', async (req,res)=>{
  const { plan } = req.body; if(!getPlan(plan)) return res.status(422).json({success:false,message:'Invalid plan'});
  const workspace = await workspaceFor(req.user.id);
  const updated = await prisma.workspace.update({where:{id:workspace.id},data:{plan}});
  await prisma.user.update({where:{id:req.user.id},data:{selectedPlan:plan}});
  res.json({success:true,message:'Plan upgraded',data:{workspace:updated,plan:getPlan(plan)}});
});
router.get('/accounts', async(req,res)=>{ const w=await workspaceFor(req.user.id); res.json({success:true,data:await prisma.socialAccount.findMany({where:{workspaceId:w.id}}),limit:getPlan(w.plan).accountLimit}); });
router.post('/accounts', async(req,res)=>{
  const { platform, accountName } = req.body; const w=await workspaceFor(req.user.id); const count=await prisma.socialAccount.count({where:{workspaceId:w.id}}); const limit=getPlan(w.plan).accountLimit;
  if(count >= limit) return res.status(403).json({success:false,message:`Your ${w.plan} plan allows only ${limit} connected account(s). Upgrade to add more.`});
  const account = await prisma.socialAccount.create({data:{workspaceId:w.id,platform,accountName:accountName || `${platform} account`}});
  res.status(201).json({success:true,message:'Account connected',data:account});
});
router.delete('/accounts/:id', async(req,res)=>{ await prisma.socialAccount.delete({where:{id:req.params.id}}); res.json({success:true,message:'Account disconnected'}); });
router.get('/posts', async(req,res)=>{ const w=await workspaceFor(req.user.id); const posts=await prisma.post.findMany({where:{workspaceId:w.id},include:{platforms:true,media:true},orderBy:{createdAt:'desc'}}); res.json({success:true,data:posts}); });
router.post('/posts', async(req,res)=>{
  const { title, baseCaption, platforms=[], status='draft', scheduledAt } = req.body; const w=await workspaceFor(req.user.id);
  const post = await prisma.post.create({data:{workspaceId:w.id,createdById:req.user.id,title,baseCaption,status,scheduledAt:scheduledAt?new Date(scheduledAt):null,platforms:{create:platforms.map(p=>({platform:p.platform,customCaption:p.customCaption||baseCaption}))}},include:{platforms:true}});
  res.status(201).json({success:true,message:'Post created',data:post});
});
router.post('/posts/:id/publish', async(req,res)=>{
  const post = await prisma.post.findUnique({where:{id:req.params.id},include:{platforms:true}}); if(!post) return res.status(404).json({success:false,message:'Post not found'});
  await prisma.post.update({where:{id:post.id},data:{status:'publishing'}});
  const results=[];
  for(const pp of post.platforms){ const r=await publishToPlatform(pp.platform,post); results.push(r); await prisma.postPlatform.update({where:{id:pp.id},data:{status:'published',publishedUrl:r.url}}); await prisma.publishingLog.create({data:{postId:post.id,platform:pp.platform,status:'success',message:'Published via demo publisher'}}); }
  const updated=await prisma.post.update({where:{id:post.id},data:{status:'published',publishedAt:new Date()},include:{platforms:true,logs:true}});
  res.json({success:true,message:'Published successfully via demo publishers',data:{post:updated,results}});
});
router.get('/media', async(req,res)=>{ const w=await workspaceFor(req.user.id); res.json({success:true,data:await prisma.mediaAsset.findMany({where:{workspaceId:w.id},orderBy:{createdAt:'desc'}})}); });
router.post('/media', async(req,res)=>{ const {fileName,fileType,fileUrl}=req.body; const w=await workspaceFor(req.user.id); const media=await prisma.mediaAsset.create({data:{workspaceId:w.id,fileName,fileType,fileUrl}}); res.status(201).json({success:true,message:'Media saved',data:media}); });
router.get('/calendar', async(req,res)=>{ const w=await workspaceFor(req.user.id); const posts=await prisma.post.findMany({where:{workspaceId:w.id,status:{in:['scheduled','published']}},orderBy:{scheduledAt:'asc'}}); res.json({success:true,data:posts}); });
module.exports = router;
