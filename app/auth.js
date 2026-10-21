// 页面只处理业务结果；加解密、真实机器码及网络请求由主进程完成。
var XunjianAuth=(function(){
  var config={loginPath:'login',savePath:'save'};
  var errorText='温馨提示：权限校验失败，请确保网络正常重新保存或重新登录',session=null,revision=0;
  var expiredText='登录已过期，请重新登录';
  // 旧页面凭据不迁移为可信授权，升级后重新登录。
  try{localStorage.removeItem('xunjian_auth_v2');}catch(e){}
  function current(){if(session&&(Date.now()<session.loginAt||Date.now()>=session.expiresAt))clear(expiredText);return session;}
  async function refresh(){
    var version=revision;
    try{
      var value=await window.desktopAPI.getSession();
      if(version!==revision)return;
      var previous=session;session=value;
      if(previous&&!session)clear(expiredText);else show();
    }catch(e){if(version===revision)clear(e.message||expiredText);}
  }
  function show(){
    var locked=!session;
    document.body.classList.toggle('auth-locked',locked);
    document.getElementById('authLogin').hidden=!locked;
    document.getElementById('authUser').textContent=session?session.username:'';
    if(locked)document.getElementById('authUsername').focus();
    else window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('xunjian-auth-changed'));
  }
  function clear(message){revision++;session=null;document.getElementById('authPassword').value='';document.getElementById('authError').textContent=message||'';show();}
  async function request(path,body){
    if(navigator.onLine===false)throw new Error(errorText);
    if(!window.desktopAPI||!window.desktopAPI.apiRequest)throw new Error('请使用桌面程序登录');
    var response=await window.desktopAPI.apiRequest({operation:path,body:body});
    var data=response.data;
    if(response.status===401||data.code===401){if(path===config.savePath)clear(errorText);throw new Error(path===config.savePath?errorText:(data.message||'用户名或密码错误'));}
    if(!response.ok||data.code!==0)throw new Error(data.message||errorText);
    return data;
  }
  async function save(job,imageName){
    var user=current();
    if(!user||user.username!==job.username)throw new Error('登录账号已变化，请用原账号登录后重试');
    var parts=job.file.relPath.replace(/\\/g,'/').split('/').filter(Boolean);
    if(parts.length<3)throw new Error('图片路径缺少线路或杆塔目录，请选择包含线路和杆塔的输入目录');
    var payload={line_name:parts[parts.length-3],tower_no:parts[parts.length-2],img_name:imageName};
    await request(config.savePath,payload);
    var latest=current();if(!latest||latest.id!==user.id)throw new Error(errorText);
  }
  document.getElementById('authForm').addEventListener('submit',async function(e){
    e.preventDefault();var button=document.getElementById('authSubmit'),error=document.getElementById('authError');
    if(button.disabled)return;
    button.disabled=true;button.textContent='登录中…';error.textContent='';
    try{
      var username=document.getElementById('authUsername').value.trim(),password=document.getElementById('authPassword').value;
      if(!username||!password)throw new Error('请输入用户名和密码');
      if(!window.desktopAPI||!window.desktopAPI.getMachineCode)throw new Error('请使用桌面程序登录，无法获取机器码');
      var machineCode=await window.desktopAPI.getMachineCode();
      if(typeof machineCode!=='string'||!machineCode.trim())throw new Error('机器码读取失败，请重新打开程序');
      var result=await request(config.loginPath,{username:username,password:password,machineCode:machineCode});
      if(!result.data||typeof result.data.username!=='string'||!result.data.id||!Number.isFinite(result.data.expiresAt))throw new Error('登录响应缺少会话信息');
      revision++;session=result.data;document.getElementById('authPassword').value='';show();
    }catch(e){error.textContent=e.message;}
    finally{button.disabled=false;button.textContent='登录';}
  });
  document.getElementById('authLogout').addEventListener('click',async function(){
    if(api.isBusy&&api.isBusy()){alert('正在处理文件或保存任务，请等待完成后退出登录');return;}
    revision++;
    try{await window.desktopAPI.logout();clear();}catch(e){clear(e.message);}
  });
  async function refreshService(){
    if(!window.desktopAPI?.getApiSettings)return;
    try{var state=await window.desktopAPI.getApiSettings();document.getElementById('authServiceStatus').textContent=state.error||(state.configured?'已配置登录服务：'+state.baseUrl:'首次使用请导入管理员提供的服务配置文件');}catch(e){document.getElementById('authError').textContent=e.message;}
  }
  document.getElementById('authImportConfig').addEventListener('click',async function(){
    var button=this;button.disabled=true;
    try{if(await window.desktopAPI.importApiConfig()){document.getElementById('authError').textContent='';await refreshService();}}catch(e){document.getElementById('authError').textContent=e.message;}finally{button.disabled=false;}
  });
  window.desktopAPI?.onAction?.(function(action){if(action==='service-configured')refreshService();});
  // 登录框显示期间拦截工作台快捷键及其他面板点击。
  ['keydown','keyup','mousedown','mouseup','click','wheel'].forEach(function(type){
    document.addEventListener(type,function(e){if(!current()&&!document.getElementById('authLogin').contains(e.target)) {e.preventDefault();e.stopImmediatePropagation();}},true);
  });
  ['keydown','keyup'].forEach(function(type){window.addEventListener(type,function(e){if(!session)e.stopImmediatePropagation();});});
  // 定时检查覆盖持续打开的窗口，焦点恢复检查覆盖休眠后返回。
  window.setInterval(refresh,30000);
  window.addEventListener('focus',refresh);
  show();
  var api={current:current,save:save,isBusy:null};api.ready=Promise.all([refresh(),refreshService()]);return api;
})();
