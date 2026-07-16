/**
 * Shared codegen helpers.
 * Extracted incrementally from api2ai/db2ai CLI code.
 */
export { compose } from './compose.js';
export * from './snippets/index.js';
export { checkToolAccessExportName, prepareToolCallExportName } from './access-stubs.js';
export * from './auth-module-names.js';
export * from './auth-pipeline-shared.js';
export * from './auth-stub-bootstrap.js';
export * from './logging-adapter-bootstrap.js';
export * from './document-validation.js';
export * from './langium-cli-types.js';
export * from './generated-layout.js';
export * from './project-bootstrap.js';
export {
    renderHttpMcpStartupBannerFn,
    renderMcpHostStartupBannerSource,
    renderOAuthHttpStartupBannerFn,
    renderStdioMcpStartupBannerFn
} from './render-mcp-host-startup-banner.js';
export * from './mcp-module-host.js';
export { writeGeneratedDemosTestSupport } from './write-demos-test-support.js';
export {
    writeGeneratedScripts,
    runGenerateBatch,
    listRootDslFiles,
    productScriptsMeta,
    generatedScriptsDirRelative,
    PROJECT_META_SCRIPT,
    PROJECT_GENERATE_CONFIG
} from '../scripts/write-generated-scripts.js';
export type { ScriptsProduct } from '../scripts/write-generated-scripts.js';
export * from './templates/index.js';
export * from './zod-codegen.js';
