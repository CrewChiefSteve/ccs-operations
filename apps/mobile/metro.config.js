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

// Force single React instance — prevents duplicate React from hoisted deps
// (e.g. @clerk/clerk-react bundles React 19 while mobile uses React 18)
config.resolver.extraNodeModules = {
  react: path.resolve(__dirname, 'node_modules/react'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
  'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
};

module.exports = config;
