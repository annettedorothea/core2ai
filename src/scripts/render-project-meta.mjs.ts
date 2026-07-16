import { GENERATED_SCRIPTS_BANNER } from './generated-scripts-banner.js';
import { productScriptsMeta, type ScriptsProduct } from './product-scripts-meta.js';

export function renderProjectMetaMjsSource(product: ScriptsProduct): string {
    const meta = productScriptsMeta(product);
    return `${GENERATED_SCRIPTS_BANNER}/** Product constants for generated demo scripts (${meta.productName}). */
export const productName = ${JSON.stringify(meta.productName)};
export const dslExtension = ${JSON.stringify(meta.dslExtension)};
export const embedHomeEnvVar = ${JSON.stringify(meta.embedHomeEnvVar)};
export const embedDirName = ${JSON.stringify(meta.embedDirName)};
export const extensionIdPrefix = ${JSON.stringify(meta.extensionIdPrefix)};
`;
}
