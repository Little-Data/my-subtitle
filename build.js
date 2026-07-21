const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseFile } = require('./src/parsers');
const { generateIndexPage, generateFilePage } = require('./src/generate');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const SUBTITLE_EXTS = ['.srt', '.ass', '.vtt'];
const EXCLUDE_DIRS = ['.git', 'node_modules', 'dist', 'src'];
const FILES_PER_PAGE = 100;

function walkDir(dirPath, basePath = '') {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = basePath ? path.join(basePath, entry.name) : entry.name;
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.includes(entry.name)) continue;
      files.push(...walkDir(fullPath, relPath));
    } else if (entry.isFile()) {
      if (SUBTITLE_EXTS.includes(path.extname(entry.name).toLowerCase())) {
        files.push({ relPath, fullPath });
      }
    }
  }
  return files;
}

function writePage(filePath, content) {
  const fullPath = path.join(DIST, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
}

function main() {
  console.log('Scanning subtitle files...');
  const entries = walkDir(ROOT);
  console.log(`Found ${entries.length} subtitle files.`);

  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

  // Build file→date map from git log in one pass
  const fileDateMap = {};
  let gitFiles = 0;
  try {
    const log = execSync('git -c core.quotepath=false log --format="%ai" --name-only --diff-filter=ACMR', { encoding: 'utf-8', cwd: ROOT, stdio: ['pipe', 'pipe', 'ignore'] });
    let currentDate = null;
    for (const line of log.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(trimmed)) {
        const p = trimmed.split(/[ :+-]/);
        currentDate = new Date(p[0], p[1]-1, p[2], p[3], p[4], p[5]);
      } else if (currentDate && !fileDateMap[trimmed]) {
        fileDateMap[trimmed] = currentDate;
        gitFiles++;
      }
    }
    console.log('Git dates mapped: ' + gitFiles);
  } catch (e) { console.log('Git not available, using filesystem dates'); }

  const fileMetas = [];
  let parsed = 0;
  let failed = 0;

  for (const { relPath, fullPath } of entries) {
    try {
      const result = parseFile(fullPath);
      if (!result) continue;
      const gitKey = relPath.replace(/\\/g, '/');
      const createdAt = fileDateMap[gitKey] || fs.statSync(fullPath).birthtime;

      const html = generateFilePage({
        path: relPath,
        name: path.basename(relPath),
        format: result.format,
        cueCount: result.cues.length,
        styles: result.styles || {}
      }, result.cues);

      const ext = path.extname(relPath);
      const base = relPath.slice(0, -ext.length);
      const outFile = base.replace(/\\/g, '/') + '.html';
      writePage(outFile, html);

      fileMetas.push({
        path: relPath,
        name: path.basename(relPath),
        format: result.format,
        cueCount: result.cues.length,
        createdAt
      });

      parsed++;
      if (parsed % 50 === 0) console.log(`  Processed ${parsed}/${entries.length}...`);
    } catch (err) {
      console.error(`  Failed: ${relPath} - ${err.message}`);
      failed++;
    }
  }

  console.log(`\nParsed: ${parsed}, Failed: ${failed}`);

  // Sort all files by creation time descending (newest first)
  const sortedFiles = fileMetas.sort((a, b) => b.createdAt - a.createdAt);

  // Generate search.json
  const searchData = sortedFiles.map(function(f, i) {
    const ext = path.extname(f.path);
    const base = f.path.slice(0, -ext.length);
    const url = base.replace(/\\/g, '/') + '.html';
    return { n: f.name, p: f.path, u: url, page: Math.floor(i / 100) + 1 };
  });
  writePage('search.json', JSON.stringify(searchData));

  // Generate index pages with pagination
  const totalPages = Math.ceil(sortedFiles.length / FILES_PER_PAGE);
  for (let p = 1; p <= totalPages; p++) {
    const html = generateIndexPage(sortedFiles, sortedFiles.length, p, totalPages);
    const outFile = p === 1 ? 'index.html' : `index.${p}.html`;
    writePage(outFile, html);
    console.log(`Written: dist/${outFile}`);
  }

  // Write .nojekyll to disable Jekyll on GitHub Pages
  writePage('.nojekyll', '');

  console.log(`\nIndex pages: ${totalPages}, File pages: ${parsed}`);
  console.log('Done! Open dist/index.html in a browser to view.');
}

main();
