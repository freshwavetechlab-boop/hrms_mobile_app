const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const projectRoot = __dirname;
const slimLucideModule = path.resolve(projectRoot, 'src/icons/lucide.ts');
const lucideIconModule = /^@app-lucide\/([a-z0-9-]+)$/;
const generatedNativeBuildFiles = [
  /[/\\]android[/\\](?:app[/\\])?build[/\\].*/,
  /[/\\]android[/\\](?:\.gradle|\.cxx)[/\\].*/,
  /[/\\]node_modules[/\\].*[/\\]android[/\\](?:build|\.cxx)[/\\].*/,
];

const config = {
  resolver: {
    blockList: generatedNativeBuildFiles,
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === 'lucide-react-native') {
        return { filePath: slimLucideModule, type: 'sourceFile' };
      }

      const iconMatch = moduleName.match(lucideIconModule);
      if (iconMatch) {
        return {
          filePath: path.resolve(
            projectRoot,
            'node_modules/lucide-react-native/dist/esm/icons',
            `${iconMatch[1]}.mjs`,
          ),
          type: 'sourceFile',
        };
      }

      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
