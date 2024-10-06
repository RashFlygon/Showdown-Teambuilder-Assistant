const path = require('path');

module.exports = {
  entry: {
    contentScript: './scripts/contentScript.js',  // Replace with the actual path to your content script
    background: './scripts/background.js',  // Replace with the path to your background script
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  mode: 'development',
};