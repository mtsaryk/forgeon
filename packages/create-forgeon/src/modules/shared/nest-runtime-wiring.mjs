import fs from 'node:fs';
import path from 'node:path';
import {
  ensureClassMember,
  ensureImportLine,
  ensureLineAfter,
  ensureLineBefore,
  ensureLoadItem,
  ensureValidatorSchema,
} from './patch-utils.mjs';

function normalize(content) {
  return content.replace(/\r\n/g, '\n');
}

export function patchAppModuleRegistration(targetRoot, options) {
  const {
    importLine,
    loadItem,
    envSchema,
    moduleLine,
    afterAnchors = [],
    beforeAnchors = [],
    fallbackAnchor = '    CoreErrorsModule,',
  } = options;

  const filePath = path.join(targetRoot, 'apps', 'api', 'src', 'app.module.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = normalize(fs.readFileSync(filePath, 'utf8'));
  content = ensureImportLine(content, importLine);
  content = ensureLoadItem(content, loadItem);
  content = ensureValidatorSchema(content, envSchema);

  if (!content.includes(moduleLine)) {
    const beforeAnchor = beforeAnchors.find((anchor) => content.includes(anchor));
    if (beforeAnchor) {
      content = ensureLineBefore(content, beforeAnchor, moduleLine);
    } else {
      const afterAnchor = afterAnchors.find((anchor) => content.includes(anchor)) ?? fallbackAnchor;
      content = ensureLineAfter(content, afterAnchor, moduleLine);
    }
  }

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}

export function patchHealthControllerServiceProbe(targetRoot, probeTargets, options) {
  if (!probeTargets.allowApi) {
    return;
  }

  const {
    importLine,
    constructorMember,
    routePath,
    methodName,
    serviceCall,
    className = 'HealthController',
    classAnchor = 'export class HealthController {',
    beforeNeedles = [],
    beforeNeedle = 'private translate(',
  } = options;

  const filePath = path.join(targetRoot, 'apps', 'api', 'src', 'health', 'health.controller.ts');
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = normalize(fs.readFileSync(filePath, 'utf8'));
  content = ensureImportLine(content, importLine);

  if (!content.includes(constructorMember)) {
    const constructorMatch = content.match(/constructor\(([\s\S]*?)\)\s*\{/m);
    if (constructorMatch) {
      const original = constructorMatch[0];
      const inner = constructorMatch[1].trimEnd();
      const normalizedInner = inner.replace(/,\s*$/, '');
      const separator = normalizedInner.length > 0 ? ',' : '';
      const next = `constructor(${normalizedInner}${separator}
    ${constructorMember},
  ) {`;
      content = content.replace(original, next);
    } else if (content.includes(classAnchor)) {
      content = content.replace(
        classAnchor,
        `${classAnchor}
  constructor(${constructorMember}) {}
`,
      );
    }
  }

  const routeDecorator = `@Get('${routePath}')`;
  if (!content.includes(routeDecorator)) {
    const method = `
  ${routeDecorator}
  async ${methodName}() {
    return ${serviceCall};
  }
`;
    const resolvedBeforeNeedle =
      beforeNeedles.find((needle) => content.includes(needle)) ?? beforeNeedle;
    content = ensureClassMember(content, className, method, { beforeNeedle: resolvedBeforeNeedle });
  }

  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
}