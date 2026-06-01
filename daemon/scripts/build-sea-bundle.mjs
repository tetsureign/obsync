import { build } from 'esbuild';

await build({
  entryPoints: ['dist/main.js'],
  bundle: true,
  platform: 'node',
  target: 'node26',
  format: 'cjs',
  outfile: 'sea/main.cjs',
  banner: {
    js: "require = require('node:module').createRequire(__filename);",
  },
  external: [
    'class-validator',
    'class-transformer',
    'class-transformer/storage',
    '@nestjs/websockets',
    '@nestjs/websockets/*',
    '@nestjs/microservices',
    '@nestjs/microservices/*',
    '@nestjs/platform-socket.io',
    'file-type',
  ],
});
