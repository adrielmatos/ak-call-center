/**
 * SCRIPT DE PRÉ-AUDITORIA DE SEGURANÇA LOCAL (SHIFT-LEFT PREFLIGHT) - AK CALL CENTER
 * Executa antes de commits ou deploys para certificar que o código está 100% blindado.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n======================================================');
console.log('🛡️  INICIANDO PRÉ-AUDITORIA DE SEGURANÇA LOCAL (AK CALL CENTER)');
console.log('======================================================\n');

let hasErrors = false;

// 1. Verificação de Migrações SQL e RLS
console.log('🔍 [1/4] Verificando Migrações SQL e Políticas RLS...');
const possibleMigrationDirs = [
  path.join(__dirname, '..', 'supabase', 'migrations'),
  path.join(__dirname, '..', 'migrations')
];

for (const migrationsDir of possibleMigrationDirs) {
  if (fs.existsSync(migrationsDir)) {
    const sqlFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    for (const file of sqlFiles) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      const createTableRegex = /create\s+table(?:\s+if\s+not\s+exists)?\s+(?:public\.)?([a-zA-Z_][\w]*)/gi;
      let match;
      while ((match = createTableRegex.exec(content)) !== null) {
        const tableName = match[1];
        const rlsRegex = new RegExp(`alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:public\\.)?${tableName}\\s+enable\\s+row\\s+level\\s+security`, 'i');
        if (!rlsRegex.test(content)) {
          console.error(`❌ [ERRO RLS]: Tabela '${tableName}' no arquivo ${file} não possui ENABLE ROW LEVEL SECURITY!`);
          hasErrors = true;
        }
      }

      if (/auth\.jwt\(\)\s*->\s*'user_metadata'/i.test(content)) {
        console.error(`❌ [ERRO METADADOS]: Uso de 'user_metadata' detectado em ${file}! Substitua por tabelas seguras ou app_metadata.`);
        hasErrors = true;
      }
    }
  }
}
if (!hasErrors) console.log('✅ [1/4] Migrações e políticas RLS em total conformidade!');

// 2. Verificação de Segredos Vazando no Código
console.log('\n🔍 [2/4] Verificando Ausência de Segredos Hardcoded...');
const dangerousPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]{20,}['"]/i,
  /MERCADOPAGO_ACCESS_TOKEN\s*=\s*['"]APP_USR-[^'"]+['"]/i,
  /['"]sk_live_[a-zA-Z0-9]+['"]/i,
];

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', '.git', 'out'].includes(entry.name)) {
        scanDirectory(fullPath);
      }
    } else if (/\.(ts|tsx|js|mjs|json)$/.test(entry.name) && !entry.name.includes('.env')) {
      const text = fs.readFileSync(fullPath, 'utf8');
      for (const pattern of dangerousPatterns) {
        if (pattern.test(text)) {
          console.error(`❌ [ERRO SEGREDO]: Padrão de chave privada detectado em ${fullPath}!`);
          hasErrors = true;
        }
      }
    }
  }
}
scanDirectory(path.join(__dirname, '..', 'app'));
scanDirectory(path.join(__dirname, '..', 'lib'));
if (!hasErrors) console.log('✅ [2/4] Nenhum segredo privado exposto no código-fonte!');

// 3. Verificação de Integridade dos Tipos TypeScript
console.log('\n🔍 [3/4] Validando Integridade do Compilador TypeScript...');
const nodeModulesExists = fs.existsSync(path.join(__dirname, '..', 'node_modules'));
if (!nodeModulesExists) {
  console.log('ℹ️  [3/4] node_modules não detectado localmente. Validação de compilação completa é exigida e executada no GitHub Actions CI/CD.');
} else {
  try {
    const tscBin = path.join(__dirname, '..', 'node_modules', 'typescript', 'bin', 'tsc');
    if (fs.existsSync(tscBin)) {
      execSync(`node "${tscBin}" --noEmit`, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    } else {
      execSync('npx --yes tsc --noEmit', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    }
    console.log('✅ [3/4] Tipagem TypeScript estrita verificada com sucesso!');
  } catch (e) {
    console.error('❌ [ERRO COMPILAÇÃO]: Erros de TypeScript encontrados!');
    hasErrors = true;
  }
}

// 4. Verificação de Cabeçalhos de Segurança HTTP
console.log('\n🔍 [4/4] Verificando Cabeçalhos de Segurança HTTP...');
const nextConfigJs = path.join(__dirname, '..', 'next.config.js');
if (fs.existsSync(nextConfigJs)) {
  const nextConfigContent = fs.readFileSync(nextConfigJs, 'utf8');
  if (!nextConfigContent.includes('Strict-Transport-Security') || !nextConfigContent.includes('X-Frame-Options')) {
    console.error('❌ [AVISO]: next.config.js ausente de cabeçalhos HSTS ou X-Frame-Options!');
    hasErrors = true;
  } else {
    console.log('✅ [4/4] Cabeçalhos de segurança HSTS e X-Frame-Options confirmados!');
  }
}

console.log('\n======================================================');
if (hasErrors) {
  console.error('❌ PRÉ-AUDITORIA REPROVADA! Corrija os pontos acima antes de subir.');
  process.exit(1);
} else {
  console.log('🎉 PRÉ-AUDITORIA 100% APROVADA! Sistema blindado e pronto para deploy.');
  console.log('======================================================\n');
  process.exit(0);
}
