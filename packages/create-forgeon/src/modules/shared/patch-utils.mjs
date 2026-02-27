import fs from 'node:fs';

export function ensureDependency(packageJson, name, version) {
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }
  packageJson.dependencies[name] = version;
}

export function ensureDevDependency(packageJson, name, version) {
  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }
  packageJson.devDependencies[name] = version;
}

export function ensureScript(packageJson, name, command) {
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  packageJson.scripts[name] = command;
}

export function ensureBuildSteps(packageJson, scriptName, requiredCommands) {
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  const current = packageJson.scripts[scriptName];
  const steps =
    typeof current === 'string' && current.trim().length > 0
      ? current
          .split('&&')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  for (const command of requiredCommands) {
    if (!steps.includes(command)) {
      steps.push(command);
    }
  }

  if (steps.length > 0) {
    packageJson.scripts[scriptName] = steps.join(' && ');
  }
}

export function ensureLineAfter(content, anchorLine, lineToInsert) {
  if (content.includes(lineToInsert)) {
    return content;
  }

  const index = content.indexOf(anchorLine);
  if (index < 0) {
    return `${content.trimEnd()}\n${lineToInsert}\n`;
  }

  const insertAt = index + anchorLine.length;
  return `${content.slice(0, insertAt)}\n${lineToInsert}${content.slice(insertAt)}`;
}

export function ensureLineBefore(content, anchorLine, lineToInsert) {
  if (content.includes(lineToInsert)) {
    return content;
  }

  const index = content.indexOf(anchorLine);
  if (index < 0) {
    return `${content.trimEnd()}\n${lineToInsert}\n`;
  }

  return `${content.slice(0, index)}${lineToInsert}\n${content.slice(index)}`;
}

export function ensureImportLine(content, importLine) {
  if (content.includes(importLine)) {
    return content;
  }

  const importMatches = [...content.matchAll(/^import\s.+;$/gm)];
  if (importMatches.length === 0) {
    return `${importLine}\n${content}`;
  }

  const lastImport = importMatches.at(-1);
  const insertAt = lastImport.index + lastImport[0].length;
  return `${content.slice(0, insertAt)}\n${importLine}${content.slice(insertAt)}`;
}

function findClassRange(content, className) {
  const classPattern = new RegExp(`export\\s+class\\s+${className}\\b`);
  const classMatch = classPattern.exec(content);
  if (!classMatch) {
    return null;
  }

  const openBrace = content.indexOf('{', classMatch.index);
  if (openBrace < 0) {
    return null;
  }

  let depth = 0;
  for (let index = openBrace; index < content.length; index += 1) {
    const char = content[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return {
          classStart: classMatch.index,
          bodyStart: openBrace + 1,
          classEnd: index,
        };
      }
    }
  }

  return null;
}

export function ensureClassMember(content, className, memberCode, options = {}) {
  const member = memberCode.trim();
  if (member.length === 0) {
    return content;
  }

  const range = findClassRange(content, className);
  if (!range) {
    return `${content.trimEnd()}\n${member}\n`;
  }

  const classBody = content.slice(range.bodyStart, range.classEnd);
  if (classBody.includes(member)) {
    return content;
  }

  let insertAt = range.classEnd;
  const beforeNeedle = options.beforeNeedle;
  if (typeof beforeNeedle === 'string' && beforeNeedle.length > 0) {
    const needleIndex = classBody.indexOf(beforeNeedle);
    if (needleIndex >= 0) {
      insertAt = range.bodyStart + needleIndex;
    }
  }

  return `${content.slice(0, insertAt)}\n\n${member}\n${content.slice(insertAt)}`;
}

export function upsertEnvLines(filePath, lines) {
  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  }

  const keys = new Set(
    content
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split('=')[0]),
  );

  const append = [];
  for (const line of lines) {
    const key = line.split('=')[0];
    if (!keys.has(key)) {
      append.push(line);
    }
  }

  const next =
    append.length > 0 ? `${content.trimEnd()}\n${append.join('\n')}\n` : `${content.trimEnd()}\n`;
  fs.writeFileSync(filePath, next.replace(/^\n/, ''), 'utf8');
}

export function ensureLoadItem(content, itemName) {
  const pattern = /load:\s*\[([^\]]*)\]/m;
  const match = content.match(pattern);
  if (!match) {
    return content;
  }

  const rawList = match[1];
  const items = rawList
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!items.includes(itemName)) {
    items.push(itemName);
  }

  const next = `load: [${items.join(', ')}]`;
  return content.replace(pattern, next);
}

export function ensureValidatorSchema(content, schemaName) {
  const pattern = /validate:\s*createEnvValidator\(\[([^\]]*)\]\)/m;
  const match = content.match(pattern);
  if (!match) {
    return content;
  }

  const rawList = match[1];
  const items = rawList
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!items.includes(schemaName)) {
    items.push(schemaName);
  }

  const next = `validate: createEnvValidator([${items.join(', ')}])`;
  return content.replace(pattern, next);
}

export function ensureNestCommonImport(content, importName) {
  const pattern = /import\s*\{([^}]*)\}\s*from '@nestjs\/common';/m;
  const match = content.match(pattern);
  if (!match) {
    return `import { ${importName} } from '@nestjs/common';\n${content}`;
  }

  const names = match[1]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!names.includes(importName)) {
    names.push(importName);
  }

  const replacement = `import { ${names.join(', ')} } from '@nestjs/common';`;
  return content.replace(pattern, replacement);
}
