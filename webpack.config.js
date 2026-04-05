const path = require('path');

module.exports = {
  entry: {
    injectedScript: './scripts/injectedScript.js', // Your entry point
  },
  output: {
    filename: '[name].bundle.js', // Output as injectedScript.bundle.js
    path: path.resolve(__dirname, 'dist'),
  },
  resolve: {
    extensions: ['.js'],
  },
  mode: 'development', // Use 'production' for production builds
};
