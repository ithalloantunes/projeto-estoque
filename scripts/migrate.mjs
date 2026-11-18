import fs from 'node:fs';
import { Pool } from 'pg';
import { migrateSchedules } from '../lib/schedules-repository.js';
const local=process.argv.includes('--local');
let options;
if(local){const c=JSON.parse(fs.readFileSync(new URL('../.runtime/local-config.json',import.meta.url),'utf8'));options={host:'127.0.0.1',port:c.databasePort,user:c.databaseUser,password:c.databasePassword,database:c.database};}
else{if(!process.env.DATABASE_URL)throw new Error('Defina DATABASE_URL ou use --local.');options={connectionString:process.env.DATABASE_URL};}
const pool=new Pool(options);
try{await migrateSchedules(pool);console.log('Migrações de escalas aplicadas.');}finally{await pool.end();}
