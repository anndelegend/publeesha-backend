const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const router = express.Router();
function token(user){ return jwt.sign({id:user.id,email:user.email}, process.env.JWT_SECRET || 'dev-secret', {expiresIn:'7d'}); }
function slugify(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') + '-' + Date.now(); }
router.post('/register', async (req,res)=>{
  try{
    const { firstName, lastName, email, password, plan='free' } = req.body;
    if(!firstName || !lastName || !email || !password) return res.status(422).json({success:false,message:'All fields are required'});
    const exists = await prisma.user.findUnique({where:{email}});
    if(exists) return res.status(409).json({success:false,message:'Email already exists'});
    const passwordHash = await bcrypt.hash(password,10);
    const user = await prisma.user.create({data:{firstName,lastName,email,passwordHash,selectedPlan:plan}});
    const workspace = await prisma.workspace.create({data:{ownerId:user.id,name:`${firstName}'s Workspace`,slug:slugify(`${firstName}-workspace`),plan}});
    await prisma.workspaceMember.create({data:{workspaceId:workspace.id,userId:user.id,role:'owner'}});
    res.status(201).json({success:true,message:'Account created successfully',data:{token:token(user),user,workspace}});
  }catch(e){ res.status(500).json({success:false,message:'Registration failed',error:e.message}); }
});
router.post('/login', async (req,res)=>{
  try{
    const { email, password } = req.body;
    if(!email || !password) return res.status(422).json({success:false,message:'Email and password are required'});
    const user = await prisma.user.findUnique({where:{email}});
    if(!user || !user.passwordHash) return res.status(401).json({success:false,message:'Invalid login details'});
    const ok = await bcrypt.compare(password,user.passwordHash);
    if(!ok) return res.status(401).json({success:false,message:'Invalid login details'});
    const workspace = await prisma.workspace.findFirst({where:{ownerId:user.id}});
    res.json({success:true,message:'Login successful',data:{token:token(user),user,workspace}});
  }catch(e){ res.status(500).json({success:false,message:'Login failed',error:e.message}); }
});
router.post('/google-demo', async (req,res)=>{
  const { email='googleuser@publeesha.com', firstName='Google', lastName='User', plan='free' } = req.body;
  let user = await prisma.user.findUnique({where:{email}});
  if(!user){
    user = await prisma.user.create({data:{firstName,lastName,email,emailVerified:true,selectedPlan:plan,googleId:'demo-google-'+Date.now()}});
    const workspace = await prisma.workspace.create({data:{ownerId:user.id,name:`${firstName}'s Workspace`,slug:slugify(`${firstName}-workspace`),plan}});
    await prisma.workspaceMember.create({data:{workspaceId:workspace.id,userId:user.id,role:'owner'}});
  }
  const workspace = await prisma.workspace.findFirst({where:{ownerId:user.id}});
  res.json({success:true,message:'Google demo signup successful. Replace with real Google OAuth in production.',data:{token:token(user),user,workspace}});
});
module.exports = router;
