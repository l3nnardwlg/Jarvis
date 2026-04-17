const { request } = require('../core/http-client');
const { logger } = require('../core/logger');

const log = logger.child('automation:web');

async function fetchUrl(url, options = {}) {
  const res = await request(url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body,
    timeout: options.timeout || 10000,
  });
  return {
    status: res.status,
    headers: res.headers,
    body: res.body,
  };
}

async function fetchJSON(url, options = {}) {
  const res = await fetchUrl(url, {
    ...options,
    headers: { 'Accept': 'application/json', ...options.headers },
  });
  return {
    status: res.status,
    data: JSON.parse(res.body),
  };
}

function extractText(html) {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

function extractLinks(html, baseUrl) {
  const links = [];
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    let href = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (href.startsWith('/') && baseUrl) {
      const url = new URL(baseUrl);
      href = `${url.protocol}//${url.host}${href}`;
    }
    if (href.startsWith('http')) {
      links.push({ url: href, text });
    }
  }
  return links;
}

function extractMetadata(html) {
  const meta = {};
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) meta.title = titleMatch[1].trim();

  const metaRegex = /<meta[^>]+(?:name|property)=["']([^"']+)["'][^>]+content=["']([^"']+)["']/gi;
  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    meta[match[1]] = match[2];
  }
  return meta;
}

async function scrape(url, options = {}) {
  const res = await fetchUrl(url, options);
  const html = res.body;
  return {
    status: res.status,
    text: extractText(html),
    links: extractLinks(html, url),
    metadata: extractMetadata(html),
    rawLength: html.length,
  };
}

module.exports = { fetchUrl, fetchJSON, extractText, extractLinks, extractMetadata, scrape };
