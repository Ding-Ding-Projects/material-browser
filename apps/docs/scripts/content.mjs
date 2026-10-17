import MarkdownIt from 'markdown-it';
import sanitize from 'sanitize-html';
import path from 'node:path';
export function renderArticle(source, filename, available) {
 const md=new MarkdownIt({html:false,linkify:false});
 const original=md.renderer.rules.link_open||((tokens,i,opts,env,self)=>self.renderToken(tokens,i,opts));
 md.renderer.rules.link_open=(tokens,i,opts,env,self)=>{const token=tokens[i], href=token.attrGet('href')||'';
 if(!/^(?:https?:|mailto:)/i.test(href)){const [p,anchor]=href.split('#');const resolved=p?path.posix.normalize(path.posix.join(path.posix.dirname(filename),p)):filename;
 token.attrSet('href',available.has(resolved)?'#/article/'+encodeURIComponent(resolved)+(anchor?'?anchor='+encodeURIComponent(anchor):''):'https://github.com/Ding-Ding-Projects/material-browser/blob/main/'+resolved.split('/').map(encodeURIComponent).join('/'));}
 return original(tokens,i,opts,env,self);};
 md.renderer.rules.image=()=>'<span class="note">[Image omitted from offline text reference. See source.]</span>';
 const ids=new Map();md.renderer.rules.heading_open=(tokens,i,opts,env,self)=>{const raw=(tokens[i+1]?.content||'').toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,'').trim().replace(/\s/g,'-');const count=ids.get(raw)||0;ids.set(raw,count+1);tokens[i].attrSet('id',raw+(count?'-'+count:''));return self.renderToken(tokens,i,opts);};
 return sanitize(md.render(source),{allowedTags:sanitize.defaults.allowedTags.concat(['h1','h2','h3','h4','h5','h6']),allowedAttributes:{...sanitize.defaults.allowedAttributes,'*':['id','class']},allowedSchemes:['http','https','mailto'],allowProtocolRelative:false});
}
