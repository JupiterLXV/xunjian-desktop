'use strict';
// 发布时拒绝未纳入混淆的内联脚本、事件处理器和 javascript: URL。
function checkHtml(html){
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
  if(!/\bsrc\s*=\s*["'][^"']+\.js["']/i.test(match[1])||match[2].trim())throw Error('HTML 包含未受保护的内联脚本');
 }
 const tags=html.replace(/<!--[\s\S]*?-->/g,'').match(/<[^>]+>/g)||[];
 if(tags.some(tag=>/\son[a-z]+\s*=|\b(?:href|src)\s*=\s*["']?\s*javascript:/i.test(tag)))throw Error('HTML 包含内联事件或 javascript: URL');
}
module.exports={checkHtml};
