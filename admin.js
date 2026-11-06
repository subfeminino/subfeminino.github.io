'use strict';
const REPO='subfeminino/subfeminino.github.io';
const API='https://api.github.com/repos/'+REPO+'/contents/';
const DB='data/articles.json';
const EDITORS_DB='data/editors.json';
const HOME_DB='data/home.json';
const $=id=>document.getElementById(id);
let token='',articles=[],selectedId=null,editorProfiles=[],selectedEditor=0,homeSettings=null;
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(text,kind=''){const m=$('message');m.textContent=text;m.className=kind;}
function encode64(text){const bytes=new TextEncoder().encode(text);let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.slice(i,i+0x8000));return btoa(s);}
function decode64(text){let s=atob(text.replace(/\s/g,''));return new TextDecoder().decode(Uint8Array.from(s,c=>c.charCodeAt(0)));}
async function api(path,opt={}){const response=await fetch(API+path,{...opt,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+token,...opt.headers}});const result=await response.json().catch(()=>({}));if(!response.ok)throw Error((result.message||'Erro ao acessar GitHub')+' (HTTP '+response.status+')');return result;}
async function readData(){const r=await api(DB+'?t='+Date.now());return {sha:r.sha,list:JSON.parse(decode64(r.content))};}
async function sync(){const [data,people,home]=await Promise.all([readData(),readEditorData(),readHomeData()]);articles=data.list;editorProfiles=people.list;homeSettings=home.settings;renderList();renderEditorList();renderHomeForm();renderQuickFeatured();return data;}
async function readHomeData(){const r=await api(HOME_DB+'?t='+Date.now());return {sha:r.sha,settings:JSON.parse(decode64(r.content))};}
async function readEditorData(){const r=await api(EDITORS_DB+'?t='+Date.now());return {sha:r.sha,list:JSON.parse(decode64(r.content))};}
function renderList(){const parent=$('storyList');parent.innerHTML='';if(!articles.length)parent.textContent='Nenhuma matéria cadastrada.';for(const a of articles){const b=document.createElement('button');b.className='story'+(a.id===selectedId?' active':'');const title=document.createElement('strong');title.textContent=a.title||'Sem título';const small=document.createElement('small');small.textContent=(a.published?'Publicada':'Rascunho')+' · '+(a.category||a.section||'Sem editoria');b.append(title,small);b.onclick=()=>openStory(a.id);parent.append(b);}}

const pendingInlinePhotos=new Map();
let currentInsertionBlock=null;
function photoFigure(item={}){
 const figure=document.createElement('figure');
 figure.className='inline-photo';
 figure.contentEditable='false';
 const pic=document.createElement('img');
 pic.alt=item.alt||'Fotografia da reportagem';
 pic.loading='lazy';
 if(item.src){pic.src=item.src;figure.dataset.src=item.src;}
 if(item.localId)figure.dataset.localId=item.localId;
 const caption=document.createElement('figcaption');
 caption.contentEditable='true';
 caption.setAttribute('role','textbox');
 caption.setAttribute('aria-label','Legenda e crédito da fotografia');
 caption.textContent=item.caption||'Legenda: escreva aqui o que aparece na foto e o crédito';
 const controls=document.createElement('div');
 controls.className='figure-actions';
 controls.contentEditable='false';
 const buttons=[
  ['↑ Mover para cima',()=>{if(figure.previousElementSibling)$('editor').insertBefore(figure,figure.previousElementSibling);}],
  ['↓ Mover para baixo',()=>{if(figure.nextElementSibling)$('editor').insertBefore(figure.nextElementSibling,figure);}],
  ['✕ Remover foto',()=>{const id=figure.dataset.localId;if(id)pendingInlinePhotos.delete(id);figure.remove();}]
 ];
 for(const [label,action] of buttons){const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=action;controls.append(button);}
 figure.append(pic,caption,controls);
 return figure;
}
function renderBlocks(blocks){
 const editor=$('editor');editor.replaceChildren();pendingInlinePhotos.clear();currentInsertionBlock=null;
 for(const b of blocks||[]){
  if(b.type==='image'){editor.append(photoFigure(b));continue;}
  const type=['h2','blockquote'].includes(b.type)?b.type:'p';
  const node=document.createElement(type);node.textContent=b.text||'';editor.append(node);
 }
 if(!editor.children.length){const p=document.createElement('p');p.append(document.createElement('br'));editor.append(p);}
}
function readBlocks(){
 const editor=$('editor'),blocks=[];
 function visit(node){
  if(node.nodeType===3){const value=node.textContent.trim();if(value)blocks.push({type:'p',text:value});return;}
  if(node.nodeType!==1)return;
  const tag=node.tagName.toLowerCase();
  if(tag==='figure'&&node.classList.contains('inline-photo')){
   const caption=node.querySelector('figcaption');
   const photo=node.querySelector('img');
   blocks.push({type:'image',src:node.dataset.src||'',localId:node.dataset.localId||'',caption:caption?caption.innerText.trim():'',alt:photo?.alt||'Fotografia da reportagem'});return;
  }
  if(['p','h2','blockquote','div'].includes(tag)){
   const value=node.innerText.trim();if(value)blocks.push({type:tag==='h2'?'h2':tag==='blockquote'?'blockquote':'p',text:value});return;
  }
  if(tag==='br')return;
  for(const child of node.childNodes)visit(child);
 }
 for(const node of editor.childNodes)visit(node);
 return blocks;
}
function clearForm(){selectedId=null;$('formTitle').textContent='Nova matéria';$('title').value='';$('section').value='campo';$('category').value='';$('date').value=new Date().toISOString().slice(0,10);$('summary').value='';$('imagePath').value='';$('cover').value='';clearPreparedCover();$('coverPreview').classList.add('hidden');$('published').checked=true;renderBlocks([]);$('preview').classList.add('hidden');message('');renderList();renderQuickFeatured();updateFeaturedShortcut();}
function openStory(id){const a=articles.find(x=>x.id===id);if(!a)return;selectedId=a.id;$('formTitle').textContent='Editar matéria';$('title').value=a.title||'';$('section').value=a.section||'campo';$('category').value=a.category||'';const parts=(a.date||'').match(/^(\d\d)\/(\d\d)\/(\d{4})$/);$('date').value=parts?parts[3]+'-'+parts[2]+'-'+parts[1]:new Date().toISOString().slice(0,10);$('summary').value=a.summary||'';$('imagePath').value=a.image||'';$('cover').value='';clearPreparedCover();previewImage(a.image||'');$('published').checked=a.published!==false;renderBlocks(a.blocks?.length?a.blocks:a.short?[{type:'p',text:a.short}]:[]);$('preview').classList.add('hidden');message('');renderList();renderQuickFeatured();window.scrollTo({top:0,behavior:'smooth'});}
function slug(title){return (title||'reportagem').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,65)||'reportagem';}
function previewImage(src){const img=$('coverPreview');if(!src){img.classList.add('hidden');return;}img.src=src;img.classList.remove('hidden');}
async function uploadImage(file,prefix='materia'){if(file.size>4*1024*1024)throw Error('Imagem maior que 4 MB. Reduza o tamanho.');if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Use JPG, PNG ou WebP.');const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';const path='assets/'+prefix+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+'.'+ext;const b64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});await api(path,{method:'PUT',body:JSON.stringify({message:'Adiciona fotografia da matéria SUB',content:b64,branch:'main'}),headers:{'Content-Type':'application/json'}});return path;}
async function save(){if(!token){message('Conecte-se primeiro.','error');return;}const title=$('title').value.trim(),summary=$('summary').value.trim();if(!title||!summary){message('Preencha o título e a linha fina/resumo.','error');return;}const btn=$('save');btn.disabled=true;message('Salvando no GitHub...');try{const latest=await readData();let current=latest.list.find(a=>a.id===selectedId),id=selectedId||slug(title);if(!selectedId){let n=2;while(latest.list.some(a=>a.id===id)){id=slug(title)+'-'+n++;}}let image=$('imagePath').value;const file=preparedCoverFile;if(file){message('Enviando capa recortada para o GitHub...');image=await uploadImage(file);}if(!image)throw Error('Escolha uma fotografia para a matéria.');const dateISO=$('date').value;const date=dateISO?dateISO.split('-').reverse().join('/'):'';const blocks=readBlocks();for(const b of blocks){if(b.type==='image'&&b.localId){const file=pendingInlinePhotos.get(b.localId);if(!file)throw Error('Não foi possível encontrar a foto selecionada. Insira novamente.');message('Enviando fotos internas para o GitHub...');b.src=await uploadImage(file,'foto-reportagem');delete b.localId;}else if(b.type==='image'){delete b.localId;}}const bodyText=blocks.filter(b=>b.type!=='image').map(b=>b.text).join(' ');const story={...current,id,title,summary,short:bodyText.slice(0,220),section:$('section').value,category:$('category').value.trim()||$('section').selectedOptions[0].text,date,image,blocks,published:$('published').checked,time:Math.max(1,Math.ceil(bodyText.split(/\s+/).length/200))+' min de leitura',updatedAt:new Date().toISOString()};if(current)latest.list=latest.list.map(a=>a.id===id?story:a);else latest.list.unshift(story);message('Publicando alterações...');await api(DB,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:(current?'Atualiza':'Adiciona')+' matéria: '+title,content:encode64(JSON.stringify(latest.list,null,2)+'\n'),sha:latest.sha,branch:'main'})});articles=latest.list;selectedId=id;$('imagePath').value=image;renderList();message('Matéria salva! O site será atualizado após a publicação do GitHub Pages.','ok');$('formTitle').textContent='Editar matéria';$('cover').value='';previewImage(image);renderBlocks(blocks);}catch(e){message('Não foi possível salvar: '+e.message+'. Se outra pessoa editou ao mesmo tempo, clique em Atualizar lista e tente novamente.','error');}finally{btn.disabled=false;}}
async function removeStory(){if(!selectedId)return message('Selecione uma matéria para excluir.','error');const a=articles.find(a=>a.id===selectedId);if(!confirm('Excluir a matéria "'+a.title+'"? Essa ação retira a matéria do portal.'))return;try{const latest=await readData();latest.list=latest.list.filter(a=>a.id!==selectedId);await api(DB,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Remove matéria: '+a.title,content:encode64(JSON.stringify(latest.list,null,2)+'\n'),sha:latest.sha,branch:'main'})});articles=latest.list;clearForm();message('Matéria removida. A imagem continuará armazenada no repositório.','ok');}catch(e){message('Erro ao excluir: '+e.message,'error');}}
function showPreview(){const title=$('title').value||'Título da reportagem';const blocks=readBlocks();$('preview').innerHTML='<h2>'+safe(title)+'</h2><p>'+safe($('summary').value)+'</p>'+blocks.map(b=>b.type==='image'?'<figure><img src="'+safe(b.src||$('editor').querySelector('figure[data-local-id="'+b.localId+'"] img')?.src||'')+'" alt="'+safe(b.alt||'Fotografia')+'"><figcaption>'+safe(b.caption||'')+'</figcaption></figure>':'<'+(b.type==='h2'?'h3':b.type==='blockquote'?'blockquote':'p')+'>'+safe(b.text)+'</'+(b.type==='h2'?'h3':b.type==='blockquote'?'blockquote':'p')+'>').join('');$('preview').classList.remove('hidden');$('preview').scrollIntoView({behavior:'smooth',block:'nearest'});}
function format(type){$('editor').focus();document.execCommand('formatBlock',false,type==='blockquote'?'blockquote':type==='h2'?'h2':'p');}
function pastePlain(e){
 const clipboard=e.clipboardData;
 const imageItem=Array.from(clipboard?.items||[]).find(item=>item.type.startsWith('image/'));
 const image=imageItem?.getAsFile()||Array.from(clipboard?.files||[]).find(file=>file.type.startsWith('image/'));
 if(image){
  e.preventDefault();
  rememberInsertionPoint();
  insertArticleImage(image);
  return;
 }
 // Evita que colagens de páginas externas insiram HTML não autorizado.
 e.preventDefault();
 const text=clipboard?.getData('text/plain')||'';
 if(text)document.execCommand('insertText',false,text);
 else message('Não foi encontrada uma imagem na área de transferência. Tente o botão Colar foto copiada ou Escolher foto do computador.','error');
}
function insertArticleImage(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>4*1024*1024){
  message('A imagem precisa ser JPG, PNG ou WebP e ter até 4 MB.','error');return;
 }
 const id='local-'+Date.now()+'-'+Math.random().toString(36).slice(2,9);
 pendingInlinePhotos.set(id,file);
 const figure=photoFigure({src:URL.createObjectURL(file),localId:id,caption:'',alt:file.name||'Fotografia da reportagem'});
 const editor=$('editor');
 if(currentInsertionBlock?.isConnected&&currentInsertionBlock.parentElement===editor){
  currentInsertionBlock.after(figure);
 }else{
  editor.append(figure);
 }
 const after=figure.nextElementSibling;
 if(!after||after.tagName!=='P'){
  const paragraph=document.createElement('p');
  paragraph.append(document.createElement('br'));
  figure.after(paragraph);
 }
 currentInsertionBlock=figure;
 figure.querySelector('figcaption').focus();
 message('Imagem inserida! Digite a legenda abaixo da foto e clique em Salvar no GitHub para publicar.','ok');
}


async function pasteImageFromClipboard(){
 if(!navigator.clipboard?.read){
  message('Seu navegador não permite ler imagens pelo botão. Experimente clicar no texto e usar Ctrl + V ou escolha uma foto do computador.','error');return;
 }
 try{
  const items=await navigator.clipboard.read();
  for(const item of items){
   const kind=item.types.find(x=>['image/png','image/jpeg','image/webp'].includes(x));
   if(kind){
    const blob=await item.getType(kind);
    const ext=kind==='image/png'?'png':kind==='image/webp'?'webp':'jpg';
    const file=new File([blob],'foto-colada.'+ext,{type:kind});
    insertArticleImage(file);
    return;
   }
  }
  message('O conteúdo copiado não inclui uma foto que possa ser colada. Copie a imagem (não o endereço), use Windows + Shift + S para capturá-la ou clique em Escolher foto do computador.','error');
 }catch(err){
  message('Não foi possível acessar a imagem copiada. Verifique a permissão de área de transferência do navegador ou use Escolher foto do computador.','error');
 }
}
$('pasteImageButton').onclick=()=>pasteImageFromClipboard();

$('connect').onclick=async()=>{const value=$('token').value.trim();if(!value)return alert('Cole seu token pessoal do GitHub.');token=value;try{await sync();$('gate').classList.add('hidden');$('workspace').classList.remove('hidden');clearForm();$('token').value='';}catch(e){token='';alert('Não foi possível acessar o repositório. Confira o token, a permissão Contents e o repositório selecionado.\n'+e.message);}};
$('disconnect').onclick=()=>{token='';articles=[];$('workspace').classList.add('hidden');$('gate').classList.remove('hidden');};
$('new').onclick=clearForm;$('reload').onclick=async()=>{try{await sync();message('Lista atualizada.','ok');}catch(e){message('Falha ao atualizar: '+e.message,'error');}};
$('save').onclick=save;$('delete').onclick=removeStory;$('previewButton').onclick=showPreview;

for(const button of document.querySelectorAll('[data-format]')){button.addEventListener('mousedown',e=>e.preventDefault());button.onclick=()=>format(button.dataset.format);}
$('editor').addEventListener('paste',pastePlain);


function switchPanel(mode){
 const editors=mode==='editors',home=mode==='home',articlesMode=mode==='articles';
 $('articleSidebar').classList.toggle('hidden',!articlesMode);
 $('editorsSidebar').classList.toggle('hidden',!editors);
 $('homeSidebar').classList.toggle('hidden',!home);
 $('articlePanel').classList.toggle('hidden',!articlesMode);
 $('editorsPanel').classList.toggle('hidden',!editors);
 $('homePanel').classList.toggle('hidden',!home);
 $('tabArticles').classList.toggle('primary',articlesMode);
 $('tabEditors').classList.toggle('primary',editors);
 $('tabHome').classList.toggle('primary',home);
 if(editors)openEditorProfile(selectedEditor);
 if(home)renderHomeForm();
}

function renderEditorList(){
 const el=$('editorList');el.replaceChildren();
 editorProfiles.forEach((p,i)=>{
  const button=document.createElement('button');
  button.className='story'+(i===selectedEditor?' active':'');
  const name=document.createElement('strong');name.textContent=p[0]||'Editora';
  const role=document.createElement('small');role.textContent=p[1]||'';
  button.append(name,role);button.onclick=()=>openEditorProfile(i);el.append(button);
 });
}
function editorMessage(text,error=false){
 const el=$('editorMessage');el.textContent=text;el.className=error?'error':'ok';
}
function startNewEditor(){
 selectedEditor=-1;
 $('editorFormTitle').textContent='Cadastrar nova editora';
 $('editorName').value='';
 $('editorRole').value='EDITORA';
 $('editorBio').value='';
 $('editorPhoto').value='';
 $('editorPhotoPreview').removeAttribute('src');
 $('editorPhotoPreview').style.display='none';
 $('saveEditor').textContent='Cadastrar e publicar editora';
 editorMessage('Selecione uma foto e preencha os dados da nova editora.');
 renderEditorList();
}
function openEditorProfile(i){
 if(!editorProfiles[i])return;
 selectedEditor=i;const p=editorProfiles[i];
 $('editorFormTitle').textContent='Editar perfil da editora';
 $('editorName').value=p[0]||'';
 $('editorRole').value=p[1]||'';
 $('editorBio').value=p[2]||'';
 $('editorPhoto').value='';
 $('editorPhotoPreview').style.display='block';
 $('editorPhotoPreview').src='assets/'+p[3];
 $('saveEditor').textContent='Salvar perfil no GitHub';
 editorMessage('');renderEditorList();
}
$('tabArticles').onclick=()=>switchPanel('articles');
$('tabEditors').onclick=()=>switchPanel('editors');
$('tabHome').onclick=()=>switchPanel('home');
$('newEditor').onclick=startNewEditor;
$('editorPhoto').onchange=()=>{
 const f=$('editorPhoto').files[0];if(!f)return;
 if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>4*1024*1024){
  editorMessage('A foto precisa ser JPG, PNG ou WebP e ter no máximo 4 MB.',true);
  $('editorPhoto').value='';return;
 }
 $('editorPhotoPreview').style.display='block';
 $('editorPhotoPreview').src=URL.createObjectURL(f);
};
$('saveEditor').onclick=async()=>{
 if(!token){editorMessage('Entre no painel com seu token.',true);return;}
 const name=$('editorName').value.trim(),role=$('editorRole').value.trim(),bio=$('editorBio').value.trim();
 if(!name||!role||!bio){editorMessage('Preencha nome, cargo e descrição.',true);return;}
 const isNew=selectedEditor===-1,photo=$('editorPhoto').files[0];
 if(isNew&&!photo){editorMessage('Selecione uma fotografia para cadastrar a nova editora.',true);return;}
 const button=$('saveEditor');button.disabled=true;editorMessage(isNew?'Cadastrando nova editora...':'Salvando alterações...');
 try{
  const latest=await readEditorData();
  if(!Array.isArray(latest.list))throw Error('Lista de editoras inválida.');
  const existing=isNew?null:latest.list[selectedEditor];
  if(!isNew&&!existing)throw Error('Perfil não encontrado. Atualize a lista.');
  let filename=existing?.[3]||'';
  if(photo){
   editorMessage('Enviando fotografia para o GitHub...');
   const path=await uploadImage(photo,'editora');
   filename=path.replace(/^assets\//,'');
  }
  const profile=[name,role,bio,filename];
  if(isNew)latest.list.push(profile);else latest.list[selectedEditor]=profile;
  await api(EDITORS_DB,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   message:(isNew?'Cadastra nova editora: ':'Atualiza perfil da editora: ')+name,
   content:encode64(JSON.stringify(latest.list,null,2)+'\n'),sha:latest.sha,branch:'main'
  })});
  editorProfiles=latest.list;
  openEditorProfile(isNew?latest.list.length-1:selectedEditor);
  editorMessage(isNew?'Nova editora cadastrada! O perfil aparecerá na página Sobre após a publicação do GitHub Pages.':'Perfil salvo! A página Sobre será atualizada após a publicação do GitHub Pages.');
 }catch(err){editorMessage('Não foi possível salvar: '+err.message,true);}
 finally{button.disabled=false;}
};

/* Inserção de fotos no ponto escolhido da reportagem */
function rememberInsertionPoint(){
 const selection=window.getSelection();
 if(!selection||!selection.rangeCount)return;
 let node=selection.anchorNode;
 if(!node||!$('editor').contains(node))return;
 if(node.nodeType!==1)node=node.parentElement;
 const block=node?.closest('p,h2,blockquote,div,figure');
 if(block&&$('editor').contains(block)){
  let top=block;while(top.parentElement&&top.parentElement!==$('editor'))top=top.parentElement;
  if(top.parentElement===$('editor'))currentInsertionBlock=top;
 }
}
$('editor').addEventListener('keyup',rememberInsertionPoint);
$('editor').addEventListener('mouseup',rememberInsertionPoint);
$('editor').addEventListener('touchend',rememberInsertionPoint);
$('insertInlineImage').onclick=()=>{
 rememberInsertionPoint();
 $('inlineImageFile').value='';
 $('inlineImageFile').click();
};
$('inlineImageFile').onchange=()=>{
 const file=$('inlineImageFile').files[0];
 if(file)insertArticleImage(file);
 $('inlineImageFile').value='';
};
// Permite arrastar fotos do computador diretamente para o texto da matéria.
$('editor').addEventListener('dragover',e=>{
 if(Array.from(e.dataTransfer?.types||[]).includes('Files'))e.preventDefault();
});
$('editor').addEventListener('drop',e=>{
 const file=Array.from(e.dataTransfer?.files||[]).find(f=>f.type.startsWith('image/'));
 if(!file)return;
 e.preventDefault();
 currentInsertionBlock=null;
 const target=document.elementFromPoint(e.clientX,e.clientY);
 if(target&&$('editor').contains(target)){
  const block=target.closest('p,h2,blockquote,figure');
  if(block)currentInsertionBlock=block;
 }
 insertArticleImage(file);
});

/* Editor da foto de abertura e Reportagem da semana */
function homeMessage(text,error=false){const el=$('homeMessage');el.textContent=text;el.style.color=error?'#a30c2a':'#236a3c';}
function renderHomeForm(){
 if(!homeSettings)return;
 $('homeHeroPhoto').value='';
 $('homeHeroPreview').src=homeSettings.heroImage||'assets/capa.jpg';
 $('homeEyebrow').value=homeSettings.heroEyebrow||'';
 $('homeTitle').value=homeSettings.heroTitle||'';
 $('homeDescription').value=homeSettings.heroDescription||'';
 const list=$('featuredStory'),chosen=homeSettings.featuredId;
 list.replaceChildren();
 for(const a of articles.filter(a=>a.published!==false)){
  const option=document.createElement('option');
  option.value=a.id;option.textContent=a.title;list.append(option);
 }
 if(Array.from(list.options).some(a=>a.value===chosen))list.value=chosen;
 updateFeaturedPreview();homeMessage('');
}
function updateFeaturedPreview(){
 const a=articles.find(a=>a.id===$('featuredStory').value);
 $('featuredPreview').textContent=a?'Destaque selecionado: '+a.title+' — capa: '+a.image:'Nenhuma matéria publicada disponível.';
}
$('featuredStory').onchange=updateFeaturedPreview;
$('homeHeroPhoto').onchange=()=>{
 const file=$('homeHeroPhoto').files[0];if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>4*1024*1024){
  homeMessage('Use uma imagem JPG, PNG ou WebP de até 4 MB.',true);$('homeHeroPhoto').value='';return;
 }
 $('homeHeroPreview').src=URL.createObjectURL(file);
};
$('saveHome').onclick=async()=>{
 if(!token)return homeMessage('Conecte-se primeiro ao GitHub.',true);
 const featuredId=$('featuredStory').value;
 if(!articles.some(a=>a.id===featuredId&&a.published!==false))return homeMessage('Escolha uma reportagem publicada.',true);
 const title=$('homeTitle').value.trim(),description=$('homeDescription').value.trim(),eyebrow=$('homeEyebrow').value.trim();
 if(!title||!description)return homeMessage('Preencha o título e a descrição da abertura.',true);
 const button=$('saveHome');button.disabled=true;homeMessage('Salvando a página inicial...');
 try{
  const latest=await readHomeData();
  let image=latest.settings.heroImage||'assets/capa.jpg';
  const photo=$('homeHeroPhoto').files[0];
  if(photo){homeMessage('Enviando a nova foto da abertura...');image=await uploadImage(photo,'abertura');}
  const settings={...latest.settings,heroImage:image,heroEyebrow:eyebrow,heroTitle:title,heroDescription:description,featuredId};
  await api(HOME_DB,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Atualiza abertura e reportagem da semana do Portal SUB',content:encode64(JSON.stringify(settings,null,2)+'\n'),sha:latest.sha,branch:'main'})});
  homeSettings=settings;renderHomeForm();
  homeMessage('Página inicial salva! O site será atualizado após a publicação do GitHub Pages.');
 }catch(error){homeMessage('Não foi possível salvar: '+error.message,true);}
 finally{button.disabled=false;}
};


/* Escolha direta da Reportagem da semana na aba Matérias */
function renderQuickFeatured(){
 const select=$('quickFeatured');
 if(!select||!homeSettings)return;
 const current=select.value||homeSettings.featuredId;
 select.replaceChildren();
 for(const story of articles.filter(a=>a.published!==false)){
  const option=document.createElement('option');
  option.value=story.id;option.textContent=story.title||'Matéria sem título';select.add(option);
 }
 select.value=Array.from(select.options).some(o=>o.value===current)?current:(homeSettings.featuredId||'');
 updateArticleFeaturedNotice();
 updateFeaturedShortcut();
}
function updateFeaturedShortcut(){
 const button=$('editFeaturedStory'),label=$('featuredStoryLabel');
 if(!button||!label)return;
 const featured=articles.find(a=>a.id===homeSettings?.featuredId);
 label.textContent=featured?featured.title:'Escolha a reportagem na seção acima ou na aba Página inicial';
 button.disabled=!featured;
 button.classList.toggle('active',!!featured&&selectedId===featured.id);
}
$('editFeaturedStory').onclick=()=>{
 const featured=articles.find(a=>a.id===homeSettings?.featuredId);
 if(!featured){message('Nenhuma reportagem da semana foi selecionada.','error');return;}
 switchPanel('articles');
 openStory(featured.id);
 $('formTitle').textContent='Editar reportagem da semana';
 $('articleFeaturedNotice').textContent='★ Você está editando a reportagem da semana. Texto, capa, legendas e fotos podem ser alterados normalmente.';
};
function updateArticleFeaturedNotice(){
 if(!homeSettings)return;
 const featured=articles.find(a=>a.id===homeSettings.featuredId);
 const text=featured?'★ Reportagem da semana atual: '+featured.title:'Ainda não há reportagem da semana selecionada.';
 const el=$('articleFeaturedNotice');if(el)el.textContent=text;
 const info=$('quickFeaturedMessage');if(info&&info.dataset.showMessage!=='yes')info.textContent=text;
}
async function setFeaturedArticle(id){
 if(!token){throw Error('Reconecte ao GitHub.');}
 const chosen=articles.find(a=>a.id===id&&a.published!==false);
 if(!chosen)throw Error('Selecione uma reportagem publicada.');
 const latest=await readHomeData();
 const settings={...latest.settings,featuredId:id};
 await api(HOME_DB,{method:'PUT',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({message:'Define Reportagem da semana: '+chosen.title,content:encode64(JSON.stringify(settings,null,2)+'\n'),sha:latest.sha,branch:'main'})});
 homeSettings=settings;
 renderQuickFeatured();
 renderHomeForm();
 updateFeaturedShortcut();
 $('quickFeatured').value=id;
 return chosen;
}
$('setQuickFeatured').onclick=async()=>{
 const button=$('setQuickFeatured'),id=$('quickFeatured').value,m=$('quickFeaturedMessage');
 button.disabled=true;m.dataset.showMessage='yes';m.textContent='Salvando Reportagem da semana no GitHub...';
 try{
  const story=await setFeaturedArticle(id);
  m.textContent='✓ Destaque salvo: '+story.title+'. Aguarde a publicação do GitHub Pages.';
 }catch(error){m.textContent='Erro ao mudar o destaque: '+error.message;}
 finally{button.disabled=false;}
};
$('editQuickFeatured').onclick=()=>{
 const id=$('quickFeatured').value;
 if(!id){$('quickFeaturedMessage').textContent='Escolha uma reportagem primeiro.';return;}
 openStory(id);
};
$('quickFeatured').onchange=()=>{
 const m=$('quickFeaturedMessage');
 m.dataset.showMessage='no';m.textContent='Clique em “Colocar em destaque” para confirmar a troca.';
};


/* Editor de capa em proporção 1,7:1: corte local antes de enviar ao GitHub. */
let preparedCoverFile=null;
let cropImage=null, cropImageUrl='', cropOffsetX=0, cropOffsetY=0, cropZoom=1;
let cropDragging=false,cropLastX=0,cropLastY=0,cropPreviousPreview='';
const cropCanvas=$('coverCropCanvas'),cropContext=cropCanvas.getContext('2d');
function cropMessage(value){$('coverCropMessage').textContent=value||'';}
function cropGeometry(){
 const w=cropCanvas.width,h=cropCanvas.height;
 if(!cropImage)return {scale:1,dw:w,dh:h};
 const base=Math.max(w/cropImage.naturalWidth,h/cropImage.naturalHeight);
 const scale=base*cropZoom;
 return {scale,dw:cropImage.naturalWidth*scale,dh:cropImage.naturalHeight*scale};
}
function limitCropOffsets(){
 if(!cropImage)return;
 const {dw,dh}=cropGeometry();
 cropOffsetX=Math.max((cropCanvas.width-dw)/2,Math.min((dw-cropCanvas.width)/2,cropOffsetX));
 cropOffsetY=Math.max((cropCanvas.height-dh)/2,Math.min((dh-cropCanvas.height)/2,cropOffsetY));
}
function drawCrop(){
 if(!cropImage)return;
 limitCropOffsets();const {dw,dh}=cropGeometry(),w=cropCanvas.width,h=cropCanvas.height;
 cropContext.clearRect(0,0,w,h);
 cropContext.drawImage(cropImage,(w-dw)/2+cropOffsetX,(h-dh)/2+cropOffsetY,dw,dh);
}
function dismissCrop(){
 $('coverCropPanel').classList.add('hidden');cropDragging=false;cropCanvas.classList.remove('dragging');
 if(cropImageUrl){URL.revokeObjectURL(cropImageUrl);cropImageUrl='';}
 cropImage=null;cropMessage('');
}
function clearPreparedCover(){
 preparedCoverFile=null;
 dismissCrop();
 $('coverCropStatus').textContent='Recorte proporcional à home (1,7:1).';
}
async function startCoverCrop(source){
 if(!source){message('Escolha uma foto de capa primeiro.','error');return;}
 dismissCrop();cropPreviousPreview=$('coverPreview').src||'';
 cropMessage('Carregando foto para ajuste...');
 const image=new Image();
 image.crossOrigin='anonymous';
 try{
  await new Promise((resolve,reject)=>{
   image.onload=resolve;image.onerror=()=>reject(Error('Não foi possível carregar essa foto para recorte.'));
   image.src=source;
  });
  cropImage=image;cropZoom=1;cropOffsetX=0;cropOffsetY=0;
  $('coverCropZoom').value='100';$('coverCropZoomLabel').textContent='100%';
  $('coverCropPanel').classList.remove('hidden');
  cropMessage('Arraste a foto para reposicionar. O corte será aplicado ao clicar em Aplicar recorte.');
  drawCrop();
 }catch(error){dismissCrop();message(error.message,'error');}
}
$('cover').addEventListener('change',()=>{
 const file=$('cover').files[0];
 if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>4*1024*1024){
  $('cover').value='';message('Escolha uma foto JPG, PNG ou WebP de até 4 MB.','error');return;
 }
 preparedCoverFile=null;
 const url=URL.createObjectURL(file);
 startCoverCrop(url).finally(()=>URL.revokeObjectURL(url)).catch(error=>message(error.message,'error'));
 // O arquivo selecionado só será enviado depois que o recorte for aplicado.
 $('cover').value='';
});
$('openCoverCrop').onclick=()=>{
 if(!$('coverCropPanel').classList.contains('hidden'))return;
 const src=$('coverPreview').getAttribute('src')||$('imagePath').value;
 if(!src){message('Selecione uma foto antes de ajustar a capa.','error');return;}
 startCoverCrop(src);
};
$('coverCropZoom').oninput=()=>{
 if(!cropImage)return;
 cropZoom=Number($('coverCropZoom').value)/100;
 $('coverCropZoomLabel').textContent=Math.round(cropZoom*100)+'%';
 drawCrop();
};
cropCanvas.addEventListener('pointerdown',e=>{
 if(!cropImage)return;
 cropDragging=true;cropLastX=e.clientX;cropLastY=e.clientY;
 cropCanvas.setPointerCapture(e.pointerId);cropCanvas.classList.add('dragging');
});
cropCanvas.addEventListener('pointermove',e=>{
 if(!cropDragging||!cropImage)return;
 const rect=cropCanvas.getBoundingClientRect();
 cropOffsetX+=(e.clientX-cropLastX)*cropCanvas.width/rect.width;
 cropOffsetY+=(e.clientY-cropLastY)*cropCanvas.height/rect.height;
 cropLastX=e.clientX;cropLastY=e.clientY;
 drawCrop();
});
function stopCropDrag(){cropDragging=false;cropCanvas.classList.remove('dragging');}
cropCanvas.addEventListener('pointerup',stopCropDrag);
cropCanvas.addEventListener('pointercancel',stopCropDrag);
$('resetCoverCrop').onclick=()=>{
 if(!cropImage)return;
 cropZoom=1;cropOffsetX=0;cropOffsetY=0;
 $('coverCropZoom').value=100;$('coverCropZoomLabel').textContent='100%';drawCrop();
};
$('cancelCoverCrop').onclick=()=>{
 dismissCrop();previewImage(preparedCoverFile?URL.createObjectURL(preparedCoverFile):$('imagePath').value);
};
$('applyCoverCrop').onclick=async()=>{
 if(!cropImage)return cropMessage('Selecione uma foto para recortar.');
 const button=$('applyCoverCrop');button.disabled=true;cropMessage('Preparando foto recortada...');
 try{
  const output=document.createElement('canvas');output.width=1190;output.height=700;
  const ctx=output.getContext('2d');const g=cropGeometry();const factor=1190/cropCanvas.width;
  ctx.drawImage(cropImage,
   ((cropCanvas.width-g.dw)/2+cropOffsetX)*factor,
   ((cropCanvas.height-g.dh)/2+cropOffsetY)*factor,
   g.dw*factor,g.dh*factor);
  const blob=await new Promise(resolve=>output.toBlob(resolve,'image/jpeg',0.88));
  if(!blob)throw Error('Não foi possível gerar o recorte.');
  if(blob.size>4*1024*1024)throw Error('Recorte excedeu 4 MB.');
  preparedCoverFile=new File([blob],'capa-sub-recortada.jpg',{type:'image/jpeg'});
  const previewUrl=URL.createObjectURL(preparedCoverFile);
  previewImage(previewUrl);
  $('coverCropStatus').textContent='✓ Capa recortada em 1190 × 700 px. Clique em Salvar no GitHub para publicar.';
  dismissCrop();
 }catch(error){cropMessage('Não foi possível aplicar: '+error.message);}
 finally{button.disabled=false;}
};
