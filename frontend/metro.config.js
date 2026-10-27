// The mock content service imports the Data pipeline's bundle (../data/output)
// and lesson images (../media) directly, so Metro must watch those folders.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(__dirname, '../data/output'),
  path.resolve(__dirname, '../media'),
];

module.exports = config;
