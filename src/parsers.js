const fs = require('fs');
const path = require('path');

function parseSRTTime(str) {
  const parts = str.replace(',', '.').split(':');
  const h = parseFloat(parts[0]) || 0;
  const m = parseFloat(parts[1]) || 0;
  const s = parseFloat(parts[2]) || 0;
  return h * 3600 + m * 60 + s;
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(7, '0')}`;
}

function stripTags(text) {
  return text.replace(/\{[^}]*\}/g, '').replace(/\\N/g, '\n').replace(/\\n/g, '\n').replace(/\r/g, '').trim();
}

function keepTags(text) {
  return text.replace(/\r/g, '').trim();
}

function parseSRT(content) {
  const blocks = content.trim().split(/\r?\n\r?\n+/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.trim().split(/\r?\n/);
    if (lines.length < 2) continue;
    const timeLine = lines.find(l => l.includes('-->'));
    if (!timeLine) continue;
    const [rawStart, rawEnd] = timeLine.split('-->').map(s => s.trim());
    const text = lines.slice(lines.indexOf(timeLine) + 1).join('\n').trim();
    if (!text) continue;
    cues.push({
      index: cues.length + 1,
      start: parseSRTTime(rawStart),
      end: parseSRTTime(rawEnd),
      startStr: rawStart,
      endStr: rawEnd,
      text: text.replace(/\r/g, '')
    });
  }
  return cues;
}

function parseVTT(content) {
  const lines = content.split(/\r?\n/);
  const cues = [];
  let i = 0;
  while (i < lines.length && !lines[i].includes('-->')) i++;
  let currentTime = null;
  let currentText = [];
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('-->')) {
      if (currentTime) {
        cues.push({
          index: cues.length + 1,
          start: parseSRTTime(currentTime[0]),
          end: parseSRTTime(currentTime[1]),
          startStr: currentTime[0],
          endStr: currentTime[1],
          text: currentText.join('\n').trim()
        });
      }
      const parts = line.split('-->').map(s => s.trim());
      currentTime = [parts[0], parts[1]];
      currentText = [];
    } else if (line.trim() === '' && currentTime) {
      continue;
    } else if (currentTime) {
      currentText.push(line);
    }
  }
  if (currentTime && currentText.length > 0) {
    cues.push({
      index: cues.length + 1,
      start: parseSRTTime(currentTime[0]),
      end: parseSRTTime(currentTime[1]),
      startStr: currentTime[0],
      endStr: currentTime[1],
      text: currentText.join('\n').trim()
    });
  }
  return cues;
}

function parseASS(content) {
  const lines = content.split(/\r?\n/);
  const info = {};
  const styleMap = {};
  let inEvents = false;
  let inStyles = false;
  let eventsFormatLine = '';
  let stylesFormatLine = '';
  const cues = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const section = trimmed.slice(1, -1).toLowerCase();
      inEvents = (section === 'events');
      inStyles = section.includes('style');
      continue;
    }

    if (inStyles) {
      if (trimmed.toUpperCase().startsWith('FORMAT:')) {
        stylesFormatLine = trimmed.slice(7).trim();
      } else if (trimmed.toUpperCase().startsWith('STYLE:') && stylesFormatLine) {
        const fields = stylesFormatLine.split(',').map(f => f.trim());
        const vals = trimmed.slice(6).trim().split(',');
        const styleObj = { name: '' };
        fields.forEach((f, i) => {
          const v = vals[i] ? vals[i].trim() : '';
          if (f === 'Name') styleObj.name = v;
          styleObj[f] = v;
        });
        if (styleObj.name) styleMap[styleObj.name] = styleObj;
      }
    } else if (inEvents) {
      if (trimmed.toUpperCase().startsWith('FORMAT:')) {
        eventsFormatLine = trimmed.slice(7).trim();
      } else if (/^(DIALOGUE|COMMENT):/i.test(trimmed)) {
        if (!eventsFormatLine) continue;
        const isComment = trimmed.toUpperCase().startsWith('COMMENT:');
        const prefixLen = isComment ? 8 : 9;
        const fmtFields = eventsFormatLine.split(',').map(f => f.trim());
        const values = [];
        let current = '';
        let inParens = 0;
        for (const ch of trimmed.slice(prefixLen).trim()) {
          if (ch === ',' && inParens === 0) {
            values.push(current.trim());
            current = '';
          } else {
            if (ch === '{') inParens++;
            if (ch === '}') inParens--;
            current += ch;
          }
        }
        values.push(current.trim());
        const startIdx = fmtFields.indexOf('Start');
        const endIdx = fmtFields.indexOf('End');
        const textIdx = fmtFields.indexOf('Text');
        const nameIdx = fmtFields.indexOf('Name');
        const effectIdx = fmtFields.indexOf('Effect');
        const styleIdx = fmtFields.indexOf('Style');
        if (startIdx === -1 || endIdx === -1 || textIdx === -1) continue;
        const rawStart = values[startIdx] || '';
        const rawEnd = values[endIdx] || '';
        const rawText = values[textIdx] || '';
        const name = nameIdx >= 0 && values[nameIdx] ? values[nameIdx].trim() : '';
        const effect = effectIdx >= 0 && values[effectIdx] ? values[effectIdx].trim() : '';
        const styleName = styleIdx >= 0 && values[styleIdx] ? values[styleIdx].trim() : '';
        const text = keepTags(rawText);
        if (!stripTags(rawText)) continue;

        cues.push({
          index: cues.length + 1,
          start: parseSRTTime(rawStart),
          end: parseSRTTime(rawEnd),
          startStr: rawStart,
          endStr: rawEnd,
          text,
          comment: isComment,
          name,
          effect,
          style: styleName
        });
      }
    } else if (trimmed.startsWith(';')) {
      continue;
    } else if (trimmed.includes(':')) {
      const colonIdx = trimmed.indexOf(':');
      const key = trimmed.slice(0, colonIdx).trim();
      const val = trimmed.slice(colonIdx + 1).trim();
      if (key && val) {
        info[key] = val;
      }
    }
  }
  return { info, styles: styleMap, cues };
}

function detectFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.srt') return 'srt';
  if (ext === '.ass') return 'ass';
  if (ext === '.vtt') return 'vtt';
  return null;
}

function parseFile(filePath) {
  const ext = detectFormat(filePath);
  if (!ext) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  switch (ext) {
    case 'srt': return { format: 'srt', cues: parseSRT(content) };
    case 'vtt': return { format: 'vtt', cues: parseVTT(content) };
    case 'ass': {
      const parsed = parseASS(content);
      return { format: 'ass', info: parsed.info, styles: parsed.styles, cues: parsed.cues };
    }
  }
}

module.exports = { parseFile, detectFormat, parseSRT, parseVTT, parseASS };
