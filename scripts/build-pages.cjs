const fs = require('node:fs');
const path = require('node:path');
const MarkdownIt = require('markdown-it');

const root = path.join(__dirname, '..');
const out = path.join(root, 'docs');
const sections = {
  biases: 'Cognitive Biases',
  habits: 'The 7 Habits',
  principles: 'Principles',
  business: 'Business',
};
const md = new MarkdownIt();
const html = md.utils.escapeHtml;
const library = 'Self Discipline Toolbox';
const imagePrefix = 'assets/';

fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
fs.copyFileSync(path.join(root, 'site/style.css'), path.join(out, 'assets/style.css'));
fs.writeFileSync(path.join(out, '.nojekyll'), '');

function render(slug, tokens) {
  const ids = new Set();
  const headings = [];
  let title;
  tokens.forEach((token, index) => {
    if (token.type === 'heading_open') {
      const heading = tokens[index + 1].children.map((child) => child.content).join('');
      if (token.tag === 'h1') {
        title = heading;
      } else {
        const base = heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'entry';
        let id = base;
        for (let suffix = 2; ids.has(id); suffix++) id = base + '-' + suffix;
        ids.add(id);
        token.attrSet('id', id);
        headings.push({ id, heading, level: token.tag.slice(1) });
      }
    }
    for (const child of token.children || []) {
      if (child.type === 'link_open') {
        const link = /^([a-z]+)\.md(#[^\s]*)?$/.exec(child.attrGet('href'));
        if (link && Object.hasOwn(sections, link[1])) {
          child.attrSet('href', link[1] + '.html' + (link[2] || ''));
        }
      }
      if (child.type === 'image') {
        const src = child.attrGet('src');
        if (src.startsWith(imagePrefix)) {
          const file = src.slice(imagePrefix.length);
          const destination = path.join(out, 'assets', file);
          fs.mkdirSync(path.dirname(destination), { recursive: true });
          fs.copyFileSync(path.join(root, 'content/assets', file), destination);
          child.attrSet('src', 'assets/' + file);
        }
        child.attrSet('loading', 'lazy');
      }
    }
  });

  const nav = Object.entries(sections).map(([name, label]) =>
    '<a href="' + name + '.html"' + (name === slug ? ' aria-current="page"' : '') + '>' + html(label) + '</a>',
  ).join('\n');
  const toc = headings.length ? '<details class="contents" open><summary>On this page</summary>'
    + '<nav aria-label="On this page"><ul>' + headings.map(({ id, heading, level }) =>
      '<li class="level-' + level + '"><a href="#' + id + '">' + html(heading) + '</a></li>',
    ).join('\n') + '</ul></nav></details>' : '';

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + html(slug === 'index' ? title : title + ' | ' + library) + '</title>',
    '<link rel="stylesheet" href="assets/style.css">',
    '</head>',
    '<body id="top">',
    '<a class="skip" href="#main">Skip to content</a>',
    '<header class="site-header"><div class="shell bar">',
    '<a class="brand" href="index.html">' + library + '</a>',
    '<nav aria-label="Library">' + nav + '</nav>',
    '</div></header>',
    '<main class="shell layout ' + (slug === 'index' ? 'home' : 'reading') + '" id="main">',
    toc,
    '<article>',
    md.renderer.render(tokens, md.options, {}),
    '</article></main>',
    '<footer class="shell footer"><a href="#top">Back to top &uarr;</a></footer>',
    '</body></html>',
    '',
  ].join('\n');
}

for (const slug of ['index', ...Object.keys(sections)]) {
  const input = fs.readFileSync(path.join(root, 'content', slug + '.md'), 'utf8');
  fs.writeFileSync(path.join(out, slug + '.html'), render(slug, md.parse(input, {})));
}
