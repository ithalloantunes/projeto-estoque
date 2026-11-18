import express from 'express';
import { schedulesRepository } from '../lib/schedules-repository.js';
import { workforceRouter } from './workforce.js';
export { migrateSchedules } from '../lib/schedules-repository.js';
export function schedulesRouter({getPool,authMiddleware,requireAdmin,notify=async()=>{}}) {
 const router=express.Router(), repo=schedulesRepository(getPool);
 router.use(authMiddleware);
 router.use('/workforce',workforceRouter({repo,requireAdmin,notify}));
 const route=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(e=>{
  if(['23505','23503','22P02','22007','22008','23514'].includes(e.code))return res.status(e.code==='23505'?409:400).json({error:e.code==='23505'?'Este vínculo ou registro já existe.':'Dados inválidos ou registro associado a outro cadastro.'});
  next(e);
 });
 const changed=async(payload)=>{try{await notify(payload);}catch(e){console.error('Falha ao notificar escala:',e.message);}};
 router.get('/me',route(async(req,res)=>res.json(await repo.getWeek(req.query.week,req.user.id))));
 router.use(requireAdmin);
 router.get('/employees',route(async(req,res)=>res.json(await repo.employees())));
 const employee=route(async(req,res)=>{const result=await repo.employee(req.user.id,req.body,req.params.id);await changed({userIds:result.userIds});res.json(result.row);});
 router.post('/employees',employee);router.put('/employees/:id',employee);
 router.get('/templates',route(async(req,res)=>res.json((await repo.query('SELECT * FROM schedule_templates ORDER BY name')).rows)));
 const template=route(async(req,res)=>{const result=await repo.template(req.user.id,req.body,req.params.id);await changed({});res.json(result);});
 router.post('/templates',template);router.put('/templates/:id',template);
 router.get('/week',route(async(req,res)=>res.json(await repo.getWeek(req.query.week))));
 router.post('/entries',route(async(req,res)=>{const result=await repo.change(req.user.id,req.body);for(const periodId of result.periodIds)await changed({periodId});res.json(result.entries[0]);}));
 router.post('/corrections',route(async(req,res)=>{const result=await repo.change(req.user.id,req.body,true);for(const periodId of result.periodIds)await changed({periodId});res.json(result);}));
 router.post('/publish',route(async(req,res)=>{const result=await repo.publish(req.user.id,req.body);await changed({periodId:result.id});res.json(result);}));
 router.post('/copy',route(async(req,res)=>{const result=await repo.copy(req.user.id,req.body);if(req.body.preview===false)await changed({periodId:result.period.id});res.json(result);}));
 router.get('/audit',route(async(req,res)=>res.json((await repo.query('SELECT a.*,u.username FROM schedule_audit a JOIN users u ON u.id=a.actor_user_id WHERE period_id=$1 ORDER BY created_at DESC',[req.query.period])).rows)));
 return router;
}
