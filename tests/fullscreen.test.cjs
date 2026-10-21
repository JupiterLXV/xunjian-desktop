'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {installFullscreenKeys}=require('../app/fullscreen.cjs');

function fixture(){
  let full=false,destroyed=false;const writes=[];
  const win={webContents:new EventEmitter(),isDestroyed:()=>destroyed,isFullScreen:()=>full,setFullScreen:value=>{full=value;writes.push(value);}};
  const toggle=installFullscreenKeys(win);
  return {win,writes,toggle,destroy:()=>{destroyed=true;},press:(key,extra={})=>{
    let prevented=false;
    win.webContents.emit('before-input-event',{preventDefault:()=>{prevented=true;}},{key,type:'keyDown',...extra});
    return prevented;
  }};
}
test('F11 进入和退出，菜单共用切换逻辑',()=>{
  const f=fixture();assert.equal(f.press('F11'),true);assert.equal(f.press('F11'),true);
  f.toggle();assert.deepEqual(f.writes,[true,false,true]);
});
test('长按和抬起 F11 不重复切换，事件不再传给页面或菜单',()=>{
  const f=fixture();f.press('F11');assert.equal(f.press('F11',{isAutoRepeat:true}),true);
  assert.equal(f.press('F11',{type:'keyUp'}),true);assert.deepEqual(f.writes,[true]);
});
test('Esc 仅在全屏时退出，普通 Esc 留给页面',()=>{
  const f=fixture();assert.equal(f.press('Escape'),false);f.toggle();assert.equal(f.press('Escape'),true);
  assert.equal(f.press('Escape'),false);assert.deepEqual(f.writes,[true,false]);
});
test('其他按键、组合键和销毁窗口不处理',()=>{
  const f=fixture();assert.equal(f.press('a'),false);
  for(const modifier of ['control','alt','meta','shift'])assert.equal(f.press('F11',{[modifier]:true}),false);
  f.destroy();assert.equal(f.press('F11'),false);f.toggle();assert.deepEqual(f.writes,[]);
});
