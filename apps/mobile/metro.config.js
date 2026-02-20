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

// Force ALL React imports (including from dependencies) to use mobile's React 18.
// extraNodeModules alone isn't enough — dependencies in monorepo root node_modules
// can still resolve React 19 from the root. resolveRequest intercepts every import.
const mobileReactPackages = {
  react: path.resolve(__dirname, 'node_modules/react'),
  'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime'),
  'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime'),
  'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
};

config.resolver.extraNodeModules = {
  react: mobileReactPackages.react,
  'react-native': mobileReactPackages['react-native'],
  'react-dom': mobileReactPackages['react-dom'],
};

// Intercept every module resolution to ensure React 18 is always used
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Pin react, react/jsx-runtime, react-dom, react-native to mobile's copies
  if (mobileReactPackages[moduleName]) {
    return {
      type: 'sourceFile',
      filePath: require.resolve(moduleName, { paths: [__dirname] }),
    };
  }
  // Fall back to default resolution
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
