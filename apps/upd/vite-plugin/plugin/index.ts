import { Plugin } from 'vite';
import { DirImporterPlugin } from './node/dir-importer.js';
import { AngularVitePluginOptions as VitePluginAngularOptions } from './plugin-options.js';
import { CommonPlugin } from './plugins/config.js';
import { DevelopmentPlugin } from './plugins/dev.plugin.js';
import { ProductionPlugin } from './plugins/prod.plugin.js';
import { checker } from 'vite-plugin-checker';
import defu from 'defu';

export function angular(options?: VitePluginAngularOptions): Plugin[] {
  const { typecheck } = defu(options, {
    typecheck: true,
  });
  const plugins = [
    CommonPlugin,
    DirImporterPlugin,
    DevelopmentPlugin,
    ...ProductionPlugin(options),
  ];
  if (typecheck) {
    plugins.push(checker({ typescript: { root: options?.workspaceRoot, tsconfigPath: options?.tsConfigPath } }));
  }
  return plugins;
}
