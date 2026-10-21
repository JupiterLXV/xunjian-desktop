'use strict';
function hardenRuntime(app){
 if(!app.isPackaged)return;
 for(const name of ['remote-debugging-port','remote-debugging-pipe','remote-allow-origins','auto-open-devtools-for-tabs'])app.commandLine.removeSwitch(name);
}
module.exports={hardenRuntime};
