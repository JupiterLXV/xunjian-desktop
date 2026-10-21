'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const afterPack=require('../scripts/after-pack.cjs');
test('Windows 发布保留第三方许可和运行组件',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'xunjian-release-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 for(const name of ['LICENSE.electron.txt','LICENSES.chromium.html','resources.pak','icudtl.dat'])await fs.writeFile(path.join(dir,name),'fixture');
 await afterPack({electronPlatformName:'win32',appOutDir:dir});
 assert.deepEqual((await fs.readdir(dir)).sort(),['LICENSE.electron.txt','LICENSES.chromium.html','icudtl.dat','resources.pak']);
 await afterPack({electronPlatformName:'win32',appOutDir:dir});
});
test('非 Windows 产物保持许可文件不变',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'xunjian-release-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 await fs.writeFile(path.join(dir,'LICENSE.electron.txt'),'fixture');
 await afterPack({electronPlatformName:'darwin',appOutDir:dir});
 assert.ok(await fs.stat(path.join(dir,'LICENSE.electron.txt')));
});
