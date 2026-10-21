'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const PRODUCT='xunjian-desktop';
function machineCode(identity){return 'XJ1-'+crypto.createHash('sha256').update(PRODUCT+'\0'+identity.trim().toLowerCase()).digest('hex').toUpperCase().match(/.{8}/g).join('-');}
async function readMachineCode(){
 let identity;
 if(process.platform==='win32'){
  const reg=path.join(process.env.SystemRoot||'C:\\Windows','System32','reg.exe');
  const {stdout}=await promisify(execFile)(reg,['query','HKLM\\SOFTWARE\\Microsoft\\Cryptography','/v','MachineGuid','/reg:64'],{windowsHide:true,timeout:10000,maxBuffer:65536});
  const match=stdout.match(/MachineGuid\s+REG_SZ\s+([a-f\d-]+)/i);
  if(!match||!/^\{?[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\}?$/i.test(match[1]))throw Error('无法读取本机标识，请检查系统注册表读取权限后重新打开。');
  identity='windows:'+match[1];
 }else if(process.platform==='linux')identity='linux:'+await fs.readFile('/etc/machine-id','utf8');
 else throw Error('机器码读取目前仅支持 Windows 和 Linux。');
 return machineCode(identity);
}
module.exports={machineCode,readMachineCode};
