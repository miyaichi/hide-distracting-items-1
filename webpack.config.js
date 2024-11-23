const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    background: './src/background/background.ts',
    contentScript: './src/contentScript/contentScript.ts',
    sidepanel: './src/sidepanel/index.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name]/[name].js',
    clean: true, // これを追加して、ビルド時に dist ディレクトリをクリーンアップ
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src/'),
    },
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: 'manifest.json',
          to: 'manifest.json',
        },
        {
          from: 'public/sidepanel.html',
          to: 'sidepanel.html',
        },
        {
          from: 'src/styles',
          to: 'styles',
        },
      ],
    }),
  ],
  devtool: 'cheap-source-map',
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
};
