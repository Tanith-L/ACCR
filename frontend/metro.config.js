// Mock mode imports the backend's sample API responses and test image
// (../backend/fixtures), and preview mode the Data pipeline's exports
// (../data/psa), so Metro must watch those folders.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(__dirname, '../backend/fixtures'),
  path.resolve(__dirname, '../data/psa'),
];
// Files outside frontend/ (the fixture image needs react-native's asset registry)
// must resolve packages from this app's node_modules. Without this the iOS and
// Android bundles fail; web happened to work.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

module.exports = config;
