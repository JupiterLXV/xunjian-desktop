'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createTray}=require('../app/tray.cjs');
test('托盘点击恢复窗口，退出走窗口关闭而不绕过保存保护',()=>{
 const calls=[];let minimized=true,destroyed=false,menu;
 class FakeTray extends EventEmitter{constructor(icon){super();assert.equal(icon,'icon.ico');}setToolTip(value){assert.equal(value,'图像标注软件');}setContextMenu(value){menu=value;}}
 const win={isDestroyed:()=>destroyed,isMinimized:()=>minimized,restore(){calls.push('restore');minimized=false;},show(){calls.push('show');},focus(){calls.push('focus');},close(){calls.push('close');}};
 const tray=createTray({Tray:FakeTray,Menu:{buildFromTemplate:value=>value},icon:'icon.ico',getWindow:()=>win});
 tray.emit('click');assert.deepEqual(calls,['restore','show','focus']);calls.length=0;
 menu[2].click();assert.deepEqual(calls,['show','focus','close']);calls.length=0;
 destroyed=true;tray.emit('double-click');menu[2].click();assert.deepEqual(calls,[]);
});
