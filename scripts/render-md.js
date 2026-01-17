const React = require('react');
const ReactDOMServer = require('react-dom/server');
const ReactMarkdown = require('react-markdown').default || require('react-markdown');
const remarkGfm = require('remark-gfm').default || require('remark-gfm');

const md = `- Renderer: React + Tailwind provide the UI and markdown rendering (via ` + '`react-markdown`' + ` + Mermaid support).`;

const element = React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, md);
const html = ReactDOMServer.renderToStaticMarkup(element);
console.log(html);
