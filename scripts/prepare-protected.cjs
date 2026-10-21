'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {obfuscate}=require('javascript-obfuscator');
const root=path.resolve(__dirname,'..'),source=path.join(root,'app'),output=path.join(root,'.build/protected');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
async function prepare(){
 await fs.mkdir(path.dirname(output),{recursive:true});
 const previous=await fs.readFile(path.join(output,'.generated'),'utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
 if(previous!==null&&previous!=='xunjian-protected-v1')throw Error('构建目录标记不匹配，停止以免覆盖文件');
 if(previous)await fs.rm(output,{recursive:true,force:true});
 else if(await fs.stat(output).then(()=>true,()=>false))throw Error('构建目录已存在且不属于本脚本');
 await fs.mkdir(path.join(output,'app'),{recursive:true});
 await fs.writeFile(path.join(output,'.generated'),'xunjian-protected-v1');
 const report=[];
 async function walk(directory,relative=''){
  for(const entry of await fs.readdir(directory,{withFileTypes:true})){
   if(entry.name.startsWith('.')||entry.name.endsWith('.map'))continue;
   const rel=path.join(relative,entry.name),src=path.join(source,rel),dst=path.join(output,'app',rel);
   if(entry.isDirectory()){await fs.mkdir(dst,{recursive:true});await walk(src,rel);continue;}
   if(!entry.isFile())throw Error('构建输入不允许符号链接：'+rel);
   // Public releases obtain deployment settings from an encrypted local profile.
   // Never resolve api-config.local.cjs or environment credentials into an artifact.
   const input=rel==='api-config.cjs'?Buffer.from("'use strict';module.exports={};\n"):await fs.readFile(src);let result=input;
   if(entry.name.endsWith('.html'))require('./check-html.cjs').checkHtml(input.toString('utf8'));
   if(/\.(cjs|js)$/.test(entry.name)){
    const code=obfuscate(input.toString('utf8'),{
     target:entry.name.endsWith('.cjs')?'node':'browser-no-eval',compact:true,
     renameGlobals:false,renameProperties:false,identifierNamesGenerator:'hexadecimal',
     stringArray:true,stringArrayEncoding:['rc4'],stringArrayThreshold:1,
     controlFlowFlattening:false,deadCodeInjection:false,debugProtection:false,selfDefending:false,
     sourceMap:false,seed:20261016
    }).getObfuscatedCode();
    new vm.Script(code,{filename:rel});result=Buffer.from(code);
    report.push({file:rel,sourceSha256:hash(input),outputSha256:hash(result),sourceBytes:input.length,outputBytes:result.length});
   }
   await fs.writeFile(dst,result);
  }
 }
 await walk(source);
 const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
 const {name,version,description,author,main}=pkg;
 await fs.writeFile(path.join(output,'package.json'),JSON.stringify({name,version,description,author,main,private:true},null,2)+'\n');
 await fs.writeFile(path.join(root,'.build/protection-report.json'),JSON.stringify(report,null,2)+'\n');
 console.log('已混淆 '+report.length+' 个 JS/CJS 文件；源码保留，未生成 source map。');
 return output;
}
if(require.main===module)prepare().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={prepare};
