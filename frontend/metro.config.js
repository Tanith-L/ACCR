// Mock mode imports the backend's sample API responses and test image
// (../backend/fixtures) directly, so Metro must watch that folder.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../backend/fixtures')];

module.exports = config;
