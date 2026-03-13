const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';
  return {
    entry: isDev ? './src/demo.ts' : './src/index.ts',
    output: {
      // Use [name] in dev so multiple chunks (vendors, worker) don't conflict.
      // Use content-hash in production for long-lived browser caching.
      filename: isDev ? '[name].js' : '[name].[contenthash:8].js',
      chunkFilename: isDev ? '[name].js' : '[name].[contenthash:8].js',
      path: path.resolve(__dirname, 'dist'),
      clean: true,
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.(vert|frag|glsl)$/,
          type: 'asset/source',
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
      }),
    ],
    optimization: {
      // Split vendor (gl-matrix) into a separate chunk for better caching.
      // Disabled in dev for faster incremental builds.
      splitChunks: isDev ? false : {
        chunks: 'all',
        cacheGroups: {
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      },
      // Separate webpack runtime only in production (keeps chunk hashes stable).
      runtimeChunk: isDev ? false : 'single',
    },
    devtool: isDev ? 'eval-source-map' : 'source-map',
    devServer: {
      static: './public',
      hot: true,
      port: 3000,
    },
  };
};
