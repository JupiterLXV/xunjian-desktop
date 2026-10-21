'use strict';
const fs=require('node:fs'),path=require('node:path');
const local=path.join(__dirname,'../api-config.local.cjs');
const settings=fs.existsSync(local)?require(local):{};
module.exports={
 baseUrl:process.env.XUNJIAN_API_BASE_URL||settings.baseUrl||'',
 paths:{login:'/manage/api/v1/login',save:'/manage/api/v1/labelRecord/save'},
 timeout:10000,
 keyBase64:process.env.XUNJIAN_API_KEY_BASE64||settings.keyBase64||''
};
