const path = require('path');

function esc(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function filePageUrl(filePath) {
  const ext = path.extname(filePath);
  const base = filePath.slice(0, -ext.length);
  return base.replace(/\\/g, '/') + '.html';
}

function generateIndexPage(allFiles, totalFiles, page, totalPages) {
  const itemsPerPage = 100;
  const start = (page - 1) * itemsPerPage;
  const end = Math.min(start + itemsPerPage, totalFiles);
  const pageFiles = allFiles.slice(start, end);

  // Build month groups for this page
  const groups = {};
  for (const f of pageFiles) {
    const key = `${f.createdAt.getFullYear()}-${String(f.createdAt.getMonth()+1).padStart(2,'0')}`;
    if (!groups[key]) groups[key] = { label: `${f.createdAt.getFullYear()}年${f.createdAt.getMonth()+1}月`, files: [] };
    groups[key].files.push(f);
  }

  // Sort groups by date desc
  const sortedGroups = Object.values(groups).sort((a, b) => b.files[0].createdAt - a.files[0].createdAt);

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>字幕存档</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,"Segoe UI","Noto Sans SC",sans-serif;background:#1a1a2e;color:#e0e0e0;padding:20px;max-width:960px;margin:auto}
h1{font-size:22px;color:#4fc3f7;margin-bottom:4px}
p.sub{color:#a0a0b0;font-size:13px;margin-bottom:12px}
.pager{display:flex;gap:6px;align-items:center;justify-content:center;padding:10px 0;flex-wrap:wrap}
.pager a,.pager span{display:inline-block;padding:4px 10px;border-radius:4px;font-size:13px}
.pager a{background:#16213e;color:#81d4fa;text-decoration:none}
.pager a:hover{background:#2a2a5a}
.pager .cur{background:#4fc3f7;color:#1a1a2e;font-weight:600}
.pager .dim{color:#555;font-size:12px}
.month-group{margin-bottom:24px}
.month-group h2{font-size:15px;color:#81d4fa;border-bottom:1px solid #2a2a4a;padding-bottom:5px;margin-bottom:8px;font-weight:500}
.file-item{display:flex;align-items:center;padding:5px 10px;border-radius:6px;transition:background .15s;gap:10px}
.file-item:hover{background:#16213e}
.file-item .name{flex:1;min-width:0}
.file-item .name a{color:#e0e0e0;text-decoration:none;font-size:13px}
.file-item .name a:hover{color:#4fc3f7}
.file-item .name .path{font-size:11px;color:#555;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file-item .meta{text-align:right;white-space:nowrap;font-size:11px;color:#a0a0b0}
#search{width:100%;padding:8px 12px;background:#0d1b2a;border:1px solid #1b3a5c;border-radius:6px;color:#e0e0e0;font-size:14px;outline:none;margin-bottom:10px;transition:border-color .2s}
#search:focus{border-color:#4fc3f7}
#search::placeholder{color:#555}
.badge{display:inline-block;padding:1px 5px;border-radius:3px;font-size:10px;font-weight:600;margin-right:4px}
.badge-srt{background:#1b5e20;color:#a5d6a7}
.badge-ass{background:#4a148c;color:#ce93d8}
.badge-vtt{background:#e65100;color:#ffcc80}
#top-btn{position:fixed;bottom:24px;right:24px;width:40px;height:40px;border-radius:50%;background:#0d47a1;border:1px solid #1565c0;color:#fff;font-size:20px;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .3s;z-index:99;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4)}
#top-btn.show{opacity:1;pointer-events:auto}
#top-btn:hover{background:#1565c0}
.gh-link{position:fixed;top:16px;right:16px;z-index:98;font-size:12px;color:#a0a0b0;text-decoration:none;background:#16213e;border:1px solid #2a2a4a;padding:4px 10px;border-radius:6px;transition:all .2s}
.gh-link:hover{background:#1a1a3e;border-color:#4fc3f7;color:#4fc3f7}
@media(max-width:600px){.gh-link{display:none}}
</style>
</head>
<body>
<a class="gh-link" href="https://github.com/Little-Data/my-subtitle" target="_blank" rel="noopener">GitHub &#8599;</a>
<h1>字幕存档</h1>
<p class="sub">共 ${totalFiles} 个字幕文件 · 第 ${page}/${totalPages} 页</p>`;

  html += '<input id="search" type="text" placeholder="搜索..." oninput="filterFiles(this.value)">';

  html += '<div id="sr" style="display:none"></div>';

  // Pagination top
  html += buildPagination(page, totalPages);

  for (const group of sortedGroups) {
    html += `<div class="month-group"><h2>${esc(group.label)}</h2>`;
    for (const f of group.files) {
      const url = filePageUrl(f.path);
      const fmtLabel = f.format.toUpperCase();
      html += `<div class="file-item" data-search="${esc((f.name + ' ' + f.path).toLowerCase())}">
<div class="name"><a href="${esc(url)}">${esc(f.name)}</a><div class="path">${esc(f.path)}</div></div>
<div class="meta"><span class="badge badge-${esc(f.format)}">${fmtLabel}</span>${f.cueCount} 条 · ${esc(fmtDate(f.createdAt))}</div>
</div>`;
    }
    html += `</div>`;
  }

  // Pagination bottom
  html += buildPagination(page, totalPages);

  const filterScript = '<script>var SD=null;fetch(\'search.json\').then(function(r){return r.json()}).then(function(d){SD=d});function filterFiles(q){q=q.toLowerCase();var sr=document.getElementById(\'sr\'),groups=document.querySelectorAll(\'.month-group\'),pagers=document.querySelectorAll(\'.pager\');if(!q){sr.style.display="none";groups.forEach(function(g){g.style.display=""});pagers.forEach(function(p){p.style.display=""});document.getElementById(\'search\').style.marginBottom="10px";return}if(!SD)return;groups.forEach(function(g){g.style.display="none"});pagers.forEach(function(p){p.style.display="none"});var results=[];SD.forEach(function(d){if(d.n.toLowerCase().indexOf(q)>=0||d.p.toLowerCase().indexOf(q)>=0)results.push(d)});results.sort(function(a,b){return a.page-b.page});sr.style.display="";document.getElementById(\'search\').style.marginBottom="4px";sr.innerHTML="<div style=\'color:#a0a0b0;font-size:12px;margin-bottom:8px\'>找到 "+results.length+" 个结果</div>";results.forEach(function(r){var div=document.createElement(\'div\');div.className=\'file-item\';div.innerHTML=\'<div class="name"><a href="\'+r.u+\'">\'+r.n+\'</a><div class="path">\'+r.p+\'</div></div><div class="meta">第\'+r.page+\'页</div>\';sr.appendChild(div)})}<\/script>';
  html += `${topBtnHtml}
${scrollScript}
${filterScript}
</body></html>`;
  return html;
}

function pageHref(n) { return n === 1 ? 'index.html' : 'index.' + n + '.html'; }

function buildPagination(current, total) {
  if (total <= 1) return '';
  let html = '<div class="pager">';
  if (current > 1) html += `<a href="index.html">首页</a><a href="${pageHref(current-1)}">上一页</a>`;
  else html += `<span class="dim">首页</span><span class="dim">上一页</span>`;

  const startPage = Math.max(1, current - 3);
  const endPage = Math.min(total, current + 3);
  if (startPage > 1) html += `<a href="index.html">1</a>${startPage > 2 ? '<span class="dim">...</span>' : ''}`;
  for (let i = startPage; i <= endPage; i++) {
    if (i === current) html += `<span class="cur">${i}</span>`;
    else html += `<a href="${pageHref(i)}">${i}</a>`;
  }
  if (endPage < total) html += `${endPage < total - 1 ? '<span class="dim">...</span>' : ''}<a href="${pageHref(total)}">${total}</a>`;

  if (current < total) html += `<a href="${pageHref(current+1)}">下一页</a><a href="${pageHref(total)}">末页</a>`;
  else html += `<span class="dim">下一页</span><span class="dim">末页</span>`;
  html += '</div>';
  return html;
}

function buildStylesSection(cues, styles) {
  const used = {};
  for (const cue of cues) {
    if (cue.style && styles[cue.style]) used[cue.style] = styles[cue.style];
  }
  const names = Object.keys(used);
  if (!names.length) return '';
  const sample = used[names[0]];
  const fields = Object.keys(sample).filter(function(k) { return k !== 'name'; });
    const colorFields = new Set(['PrimaryColour', 'SecondaryColour', 'OutlineColour', 'BackColour']);
  const fieldLabels = {
    Name: '名称', Fontname: '字体', Fontsize: '字号',
    PrimaryColour: '主色', SecondaryColour: '辅色', OutlineColour: '描边色', BackColour: '背景色',
    Bold: '粗体', Italic: '斜体', Underline: '下划线', StrikeOut: '删除线',
    ScaleX: '水平缩放', ScaleY: '垂直缩放', Spacing: '间距', Angle: '角度',
    BorderStyle: '边框样式', Outline: '描边', Shadow: '阴影', Alignment: '对齐',
    MarginL: '左边距', MarginR: '右边距', MarginV: '垂直边距', Encoding: '编码'
  };
  let html = '<div id="styles-info"><div class="si-header" onclick="this.nextElementSibling.classList.toggle(\'open\');this.querySelector(\'.arrow\').classList.toggle(\'open\')"><span class="arrow">&#9654;</span> 样式信息 (' + names.length + ')</div><div class="si-body">';
  for (const name of names) {
    const s = used[name];
    html += '<div class="style-group"><div class="sg-name">' + esc(name) + '</div><div class="sg-fields">';
    for (const f of fields) {
      const v = s[f];
      if (v !== undefined && v !== '') {
        const label = fieldLabels[f] || f;
        let swatch = '';
        if (colorFields.has(f) && /^&H[0-9a-fA-F]{6,8}$/.test(v)) {
          const hex = v.replace(/^&H/, '');
          const rr = hex.slice(-2);
          const gg = hex.slice(-4, -2);
          const bb = hex.slice(-6, -4);
          swatch = '<span class="cs" style="background:#' + rr + gg + bb + '"></span>';
        }
        html += '<span class="fk" title="' + esc(f) + '">' + esc(label) + '</span><span class="fv">' + swatch + esc(v) + '</span>';
      }
    }
    html += '</div></div>';
  }
  html += '</div></div>';
  return html;
}

function generateFilePage(fileInfo, cues) {
  const hasTags = fileInfo.format === 'ass';

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(fileInfo.name)} · 字幕存档</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,"Segoe UI","Noto Sans SC",sans-serif;background:#1a1a2e;color:#e0e0e0;padding:20px;max-width:800px;margin:auto}
a{color:#4fc3f7;text-decoration:none}
a:hover{text-decoration:underline}
h1{font-size:18px;margin-bottom:2px;color:#e0e0e0}
.info{font-size:12px;color:#a0a0b0;margin-bottom:16px}
.info span{margin-right:12px}
.back-link{display:inline-block;margin-bottom:12px;font-size:13px}
.toggle{padding:6px 0 10px;font-size:13px;color:#a0a0b0;display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none}
.toggle input{cursor:pointer}
#cues{margin-top:4px}
.cue{background:#16213e;border:1px solid #2a2a4a;border-radius:6px;margin-bottom:5px;overflow:hidden}
.cue-header{display:flex;align-items:center;gap:10px;padding:4px 12px;background:#1a1a35;font-size:12px;color:#a0a0b0}
.cue-index{font-weight:600;color:#4fc3f7;min-width:24px}
.cue-time{font-family:Consolas,"Courier New",monospace;font-size:11px}
.cue-time .sep{color:#e94560;margin:0 4px}
.cue-body{padding:7px 12px;font-size:14px;line-height:1.7;white-space:pre-wrap;word-break:break-word}
.cue-comment{border-color:#555;opacity:.65}.cue-comment .cue-header{background:#111;color:#666}.cue-comment .cue-body{color:#888;font-style:italic}
.cue-comment .cue-index{color:#666}
.cue-label{display:inline-block;padding:1px 5px;border-radius:3px;font-size:10px;font-weight:600;margin-right:6px}
.cue-label-comment{background:#333;color:#999;border:1px solid #555}
.cue-meta{display:inline-block;padding:1px 5px;border-radius:3px;font-size:10px;margin-right:6px}
.cue-meta-name{background:#0d47a1;color:#90caf9}
.cue-meta-effect{background:#e65100;color:#ffcc80}
.cue-meta-style{background:#004d40;color:#80cbc4}
#styles-info{margin-top:16px;background:#0d1b2a;border:1px solid #1b3a5c;border-radius:8px;overflow:hidden}
#styles-info .si-header{display:flex;align-items:center;gap:6px;padding:8px 12px;cursor:pointer;user-select:none;font-size:13px;color:#81d4fa;font-weight:500}
#styles-info .si-header:hover{background:rgba(255,255,255,.03)}
#styles-info .si-header .arrow{display:inline-block;transition:transform .2s;font-size:10px;color:#607d8b}
#styles-info .si-header .arrow.open{transform:rotate(90deg)}
#styles-info .si-body{max-height:0;overflow:hidden;transition:max-height .35s ease;padding:0 12px}
#styles-info .si-body.open{max-height:9999px;padding:0 12px 12px}
.style-group{margin-bottom:10px;padding:8px 10px;background:#0f1a2e;border-radius:6px}
.style-group:last-child{margin-bottom:0}
.style-group .sg-name{font-size:13px;font-weight:600;color:#80cbc4;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #1a2a3a}
.style-group .sg-fields{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;font-size:11px;line-height:1.7}
.style-group .sg-fields .fk{color:#607d8b;white-space:nowrap;text-align:right}
.style-group .sg-fields .fv{color:#ccc;word-break:break-all}
.cs{display:inline-block;width:12px;height:12px;border-radius:2px;vertical-align:middle;margin-right:4px;border:1px solid rgba(255,255,255,.15)}
.st{color:#e94560;background:rgba(233,69,96,0.08);border-radius:2px;font-size:11px;font-family:Consolas,monospace;padding:0 1px}
.hide-st .st{display:none}
.st-br{display:none}
.hide-st .st-br{display:inline}
#top-btn{position:fixed;bottom:24px;right:24px;width:40px;height:40px;border-radius:50%;background:#0d47a1;border:1px solid #1565c0;color:#fff;font-size:20px;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .3s;z-index:99;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4)}
#top-btn.show{opacity:1;pointer-events:auto}
#top-btn:hover{background:#1565c0}
.gh-link{position:fixed;top:16px;right:16px;z-index:98;font-size:12px;color:#a0a0b0;text-decoration:none;background:#16213e;border:1px solid #2a2a4a;padding:4px 10px;border-radius:6px;transition:all .2s}
.gh-link:hover{background:#1a1a3e;border-color:#4fc3f7;color:#4fc3f7}
@media(max-width:600px){.gh-link{display:none}}
</style>
</head>
<body>
<a class="gh-link" href="https://github.com/Little-Data/my-subtitle" target="_blank" rel="noopener">GitHub &#8599;</a>
<a class="back-link" href="javascript:history.back()" onclick="history.back();return false">← 返回</a>
<h1>${esc(fileInfo.name)}</h1>
<div class="info"><span>${esc(fileInfo.path)}</span><span>${fileInfo.format.toUpperCase()}</span><span>共 ${fileInfo.cueCount} 条字幕</span></div>
${hasTags ? '<label class="toggle"><input type="checkbox" checked onchange="document.body.classList.toggle(\'hide-st\',!this.checked)"> 显示行内样式</label>' : ''}
${buildStylesSection(cues, fileInfo.styles)}
<div id="cues">`;

  for (const cue of cues) {
    let body = esc(cue.text);
    if (hasTags) {
      body = body.replace(/\\N/g, '<span class="st">\\N</span><br class="st-br">');
      body = body.replace(/\\n/g, '<span class="st">\\n</span><br class="st-br">');
      body = body.replace(/\{([^}]*)\}/g, '<span class="st">{$1}</span>');
    }
    const commentCls = cue.comment ? ' cue-comment' : '';
    const commentLabel = cue.comment ? '<span class="cue-label cue-label-comment">注释行</span>' : '';
    const nameBadge = hasTags && cue.name ? `<span class="cue-meta cue-meta-name">${esc(cue.name)}</span>` : '';
    const effectBadge = hasTags && cue.effect ? `<span class="cue-meta cue-meta-effect">${esc(cue.effect)}</span>` : '';
    const styleBadge = hasTags && cue.style ? `<span class="cue-meta cue-meta-style">${esc(cue.style)}</span>` : '';
    html += `<div class="cue${commentCls}">
<div class="cue-header"><span class="cue-index">#${cue.index}</span><span class="cue-time">${esc(cue.startStr)}<span class="sep">→</span>${esc(cue.endStr)}</span>${commentLabel}${styleBadge}${nameBadge}${effectBadge}</div>
<div class="cue-body">${body}</div>
</div>`;
  }

  html += `</div>
${topBtnHtml}
${scrollScript}
</body></html>`;
  return html;
}

const topBtnHtml = '<button id="top-btn" onclick="window.scrollTo({top:0,behavior:\'smooth\'})" title="回到顶部">&#8593;</button>';
const scrollScript = '<script>window.addEventListener(\'scroll\',function(){document.getElementById(\'top-btn\').classList.toggle(\'show\',window.scrollY>300)})<\/script>';

module.exports = { generateIndexPage, generateFilePage };
