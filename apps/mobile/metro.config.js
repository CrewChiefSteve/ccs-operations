const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const monorepoRoot = path.resolve(__dirname, '../..');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve files from the monorepo root (convex/_generated/)
config.watchFolders = [...(config.watchFolders ?? []), monorepoRoot];

// Prefer the app's own node_modules, fall back to monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
