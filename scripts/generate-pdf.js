const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const mdPath = path.join(rootDir, 'docs', 'PMS_Authentication_Technical_Guide.md');
const htmlPath = path.join(rootDir, 'docs', 'PMS_Authentication_Technical_Guide.html');
const pdfPath = path.join(rootDir, 'docs', 'PMS_Authentication_Technical_Guide.pdf');

const mdContent = fs.readFileSync(mdPath, 'utf8');

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function markdownToHtml(md) {
  const lines = md.split('\n');
  let html = [];
  let inCode = false;
  let codeLang = '';
  let codeLines = [];
  let inTable = false;
  let tableRows = [];
  let inList = false;
  let listType = 'ul';

  function closeList() {
    if (inList) {
      html.push(`</${listType}>`);
      inList = false;
    }
  }

  function closeTable() {
    if (inTable) {
      let tableHtml = '<table>\n<thead>\n<tr>';
      const headers = tableRows[0];
      headers.forEach(h => {
        tableHtml += `<th>${inlineFormat(h.trim())}</th>`;
      });
      tableHtml += '</tr>\n</thead>\n<tbody>\n';
      for (let i = 2; i < tableRows.length; i++) {
        tableHtml += '<tr>';
        tableRows[i].forEach(cell => {
          tableHtml += `<td>${inlineFormat(cell.trim())}</td>`;
        });
        tableHtml += '</tr>\n';
      }
      tableHtml += '</tbody>\n</table>';
      html.push(tableHtml);
      inTable = false;
      tableRows = [];
    }
  }

  function inlineFormat(text) {
    return text
      .replace(/`([^`]+)`/g, (m, code) => `<code>${escapeHtml(code)}</code>`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.trim().startsWith('```')) {
      if (inCode) {
        html.push(`<pre><code class="language-${codeLang}">${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        inCode = false;
        codeLines = [];
      } else {
        closeList();
        closeTable();
        inCode = true;
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    // Tables
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      closeList();
      const cols = line.trim().slice(1, -1).split('|');
      if (!inTable) {
        inTable = true;
        tableRows = [cols];
      } else {
        tableRows.push(cols);
      }
      continue;
    } else {
      closeTable();
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      const text = inlineFormat(headingMatch[2]);
      html.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    // Horizontal Rule
    if (/^---|\*\*\*|___$/.test(line.trim())) {
      closeList();
      html.push('<hr />');
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      closeList();
      html.push(`<blockquote>${inlineFormat(line.slice(2))}</blockquote>`);
      continue;
    }

    // Unordered List
    const ulMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        closeList();
        inList = true;
        listType = 'ul';
        html.push('<ul>');
      }
      html.push(`<li>${inlineFormat(ulMatch[2])}</li>`);
      continue;
    }

    // Ordered List
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        closeList();
        inList = true;
        listType = 'ol';
        html.push('<ol>');
      }
      html.push(`<li>${inlineFormat(olMatch[2])}</li>`);
      continue;
    }

    // Blank line
    if (!line.trim()) {
      closeList();
      continue;
    }

    // Regular Paragraph
    closeList();
    html.push(`<p>${inlineFormat(line)}</p>`);
  }

  closeList();
  closeTable();

  return html.join('\n');
}

const bodyHtml = markdownToHtml(mdContent);

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>WAYMARK PMS Authentication Technical Guide</title>
<style>
  @page {
    margin: 18mm 16mm 18mm 16mm;
    size: A4;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
    color: #1e293b;
    font-size: 13px;
    padding: 0;
    margin: 0;
  }
  h1 {
    color: #0f172a;
    font-size: 24px;
    border-bottom: 2px solid #0284c7;
    padding-bottom: 8px;
    margin-top: 24px;
    page-break-after: avoid;
  }
  h2 {
    color: #0369a1;
    font-size: 18px;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 4px;
    margin-top: 22px;
    page-break-after: avoid;
  }
  h3 {
    color: #0f172a;
    font-size: 15px;
    margin-top: 16px;
    page-break-after: avoid;
  }
  h4 {
    color: #334155;
    font-size: 13px;
    margin-top: 12px;
    page-break-after: avoid;
  }
  p {
    margin: 8px 0;
    text-align: justify;
  }
  code {
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
    background: #f1f5f9;
    color: #0f172a;
    padding: 2px 5px;
    border-radius: 4px;
    font-size: 11.5px;
    border: 1px solid #e2e8f0;
  }
  pre {
    background: #0f172a;
    color: #f8fafc;
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 11px;
    line-height: 1.45;
    page-break-inside: avoid;
  }
  pre code {
    background: transparent;
    color: #f8fafc;
    border: none;
    padding: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 11.5px;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 6px 10px;
    text-align: left;
  }
  th {
    background: #f8fafc;
    font-weight: 600;
    color: #0f172a;
  }
  tr:nth-child(even) {
    background: #f8fafc;
  }
  blockquote {
    border-left: 4px solid #0284c7;
    margin: 10px 0;
    padding: 6px 12px;
    background: #f0f9ff;
    color: #0369a1;
    font-style: italic;
  }
  hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 20px 0;
  }
  ul, ol {
    margin: 6px 0;
    padding-left: 24px;
  }
  li {
    margin: 3px 0;
  }
  a {
    color: #0284c7;
    text-decoration: none;
  }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

fs.writeFileSync(htmlPath, fullHtml, 'utf8');
console.log('Generated HTML at:', htmlPath);

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');

const edgeCmd = `"${edgePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${pdfPath}" --no-pdf-header-footer "${fileUrl}"`;
console.log('Printing to PDF via Edge...');

try {
  execSync(edgeCmd, { stdio: 'inherit' });
  console.log('Successfully created PDF at:', pdfPath);
} catch (err) {
  console.error('Failed to run Edge headless PDF generator:', err.message);
}
