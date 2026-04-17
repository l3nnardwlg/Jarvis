const fs = require('fs');
const path = require('path');
const config = require('../core/config');
const { logger } = require('../core/logger');
const { isPathAllowed } = require('./executor');

const log = logger.child('automation:filesystem');

function ensureAllowed(targetPath) {
  if (!isPathAllowed(targetPath)) {
    throw new Error(`Access denied: ${targetPath}`);
  }
}

function readFile(filePath, encoding = 'utf8') {
  ensureAllowed(filePath);
  return fs.readFileSync(filePath, encoding);
}

function writeFile(filePath, content) {
  ensureAllowed(filePath);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
}

function appendFile(filePath, content) {
  ensureAllowed(filePath);
  fs.appendFileSync(filePath, content);
}

function deleteFile(filePath) {
  ensureAllowed(filePath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function listDir(dirPath, options = {}) {
  ensureAllowed(dirPath);
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries.map(e => ({
    name: e.name,
    type: e.isDirectory() ? 'directory' : 'file',
    path: path.join(dirPath, e.name),
  }));
}

function listDirRecursive(dirPath, maxDepth = 3, currentDepth = 0) {
  ensureAllowed(dirPath);
  if (currentDepth >= maxDepth) return [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push({ name: entry.name, type: 'directory', path: fullPath });
      results.push(...listDirRecursive(fullPath, maxDepth, currentDepth + 1));
    } else {
      results.push({ name: entry.name, type: 'file', path: fullPath });
    }
  }
  return results;
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function fileInfo(filePath) {
  ensureAllowed(filePath);
  const stats = fs.statSync(filePath);
  return {
    size: stats.size,
    created: stats.birthtime,
    modified: stats.mtime,
    isDirectory: stats.isDirectory(),
    isFile: stats.isFile(),
  };
}

function createDir(dirPath) {
  ensureAllowed(dirPath);
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFile(src, dest) {
  ensureAllowed(src);
  ensureAllowed(dest);
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, dest);
}

function moveFile(src, dest) {
  ensureAllowed(src);
  ensureAllowed(dest);
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.renameSync(src, dest);
}

module.exports = {
  readFile, writeFile, appendFile, deleteFile,
  listDir, listDirRecursive, fileExists, fileInfo,
  createDir, copyFile, moveFile,
};
