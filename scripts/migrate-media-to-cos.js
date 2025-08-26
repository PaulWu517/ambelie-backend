const https = require('https');
const http = require('http');
const { Pool } = require('pg');
const COS = require('cos-nodejs-sdk-v5');
const path = require('path');
const url = require('url');

// 优先尝试从后端根目录加载 .env（适配 npm run 时的独立脚本场景）
try {
  const dotenv = require('dotenv');
  const envPath = path.resolve(__dirname, '..', '.env');
  // 先尝试使用明确路径
  const res1 = dotenv.config({ path: envPath });
  if (res1.error) {
    // 再尝试默认当前工作目录
    dotenv.config();
  }
} catch (e) {
  // 若没有安装 dotenv，不影响后续；用户可用 PowerShell 设置环境变量
}

// 日志级别控制，默认 info；设为 warn 可显著减少 I/O 开销
const LOG_LEVEL = (process.env.MIGRATE_LOG_LEVEL || 'info').toLowerCase();
const __originalConsoleLog = console.log.bind(console);
console.log = (...args) => {
  if (LOG_LEVEL === 'info' || LOG_LEVEL === 'debug') {
    __originalConsoleLog(...args);
  }
};
console.debug = (...args) => {
  if (LOG_LEVEL === 'debug') {
    __originalConsoleLog(...args);
  }
};

// 统一读取 SSL 开关
const USE_SSL = (process.env.DATABASE_SSL || 'false').toLowerCase() === 'true';
const REJECT_UNAUTHORIZED = (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || 'false').toLowerCase() === 'true';
// 显式 schema，避免 search_path 导致表不存在错误
const SCHEMA = process.env.DATABASE_SCHEMA || 'public';
// 支持多种候选的上传表名（不同 Strapi 版本/自定义可能不同）
const TABLE_CANDIDATES = ['upload_files', 'upload_file', 'files'];
// 模块级变量，供 migrateFile 使用
let UPLOAD_TABLE = null;

async function findUploadTable(client, schema) {
  // 1) 直接尝试常见候选
  for (const name of TABLE_CANDIDATES) {
    const fq = `"${schema}"."${name}"`;
    try {
      await client.query(`SELECT 1 FROM ${fq} LIMIT 1`);
      return fq;
    } catch (_) {}
  }
  // 2) 回退：基于列特征在 information_schema 中探测
  try {
    const res = await client.query(
      `SELECT table_name
       FROM information_schema.columns
       WHERE table_schema = $1
       GROUP BY table_name
       HAVING SUM(CASE WHEN column_name IN ('url','mime','formats','provider') THEN 1 ELSE 0 END) >= 3
       ORDER BY table_name
       LIMIT 1`,
      [schema]
    );
    if (res.rows && res.rows[0] && res.rows[0].table_name) {
      return `"${schema}"."${res.rows[0].table_name}"`;
    }
  } catch (_) {}
  return null;
}

/**
 * 媒体迁移到腾讯云 COS 的脚本
 * 
 * 功能：
 * 1. 从 PostgreSQL 数据库读取所有未迁移的媒体文件记录
 * 2. 从旧的 Railway 域名下载文件
 * 3. 上传到腾讯云 COS
 * 4. 更新数据库中的 URL（包括 formats 中的缩略图 URL）
 * 
 * 使用前请确保：
 * - 数据库已备份
 * - 腾讯云 COS 凭证已配置
 * - 网络连接正常
 */

// 运行时可调参数（可通过环境变量微调）
const USE_KEEPALIVE = (process.env.MIGRATE_HTTP_KEEPALIVE || 'true').toLowerCase() === 'true';
const DOWNLOAD_TIMEOUT_MS = parseInt(process.env.MIGRATE_DOWNLOAD_TIMEOUT_MS || '20000', 10); // 默认 20s 失败快
const UPLOAD_TIMEOUT_MS = parseInt(process.env.MIGRATE_UPLOAD_TIMEOUT_MS || '30000', 10); // 默认 30s
const BACKOFF_MAX_MS = parseInt(process.env.MIGRATE_BACKOFF_MAX_MS || '3000', 10); // 将最大退避限制到 3s，加快失败快进
const FORMATS_CONCURRENCY = Math.max(1, parseInt(process.env.MIGRATE_FORMATS_CONCURRENCY || '2', 10));

// 配置
const CONFIG = {
  // PostgreSQL 连接配置
  db: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT) || 5432,
    database: process.env.DATABASE_NAME || 'railway',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || '',
    ssl: USE_SSL ? { rejectUnauthorized: REJECT_UNAUTHORIZED } : false,
  },
  
  // 腾讯云 COS 配置
  cos: {
    SecretId: process.env.TENCENT_COS_SECRET_ID,
    SecretKey: process.env.TENCENT_COS_SECRET_KEY,
    Bucket: process.env.TENCENT_COS_BUCKET,
    Region: process.env.TENCENT_COS_REGION,
  },
  
  // 域名配置
  domains: {
    // 旧域名（需要迁移的）
    oldDomains: [
      'https://ambelie-backend-production.up.railway.app',
      'https://ambelie-strapi.up.railway.app'
    ],
    // 新的 CDN 域名（优先读取环境变量 TENCENT_COS_CDN_DOMAIN）
    newDomain: process.env.TENCENT_COS_CDN_DOMAIN || 'https://media.ambelie.com',
    // COS 原始域名（作为备用）
    cosDomain: 'https://ambelie-1368352639.cos.ap-guangzhou.myqcloud.com'
  }
};

// 初始化数据库和 COS 客户端
// 优先使用 DATABASE_URL，其次使用单独参数
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: USE_SSL ? { rejectUnauthorized: REJECT_UNAUTHORIZED } : false })
  : new Pool(CONFIG.db);
const cos = new COS({
  SecretId: CONFIG.cos.SecretId,
  SecretKey: CONFIG.cos.SecretKey,
  // 增加 SDK 超时，避免长时间挂起（可配置）
  Timeout: UPLOAD_TIMEOUT_MS,
});

/**
 * 从 URL 下载文件到 Buffer
 */
// 为 HTTP(S) 启用 Keep-Alive，提升大量小文件迁移的网络效率（可开关）
const httpsAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 10000, maxSockets: 50, maxFreeSockets: 10 });
const httpAgent = new http.Agent({ keepAlive: true, keepAliveMsecs: 10000, maxSockets: 50, maxFreeSockets: 10 });

// 简单的 sleep 工具
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// 单次请求下载实现
function doHttpDownload(fileUrl) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(fileUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const isHttps = parsedUrl.protocol === 'https:';
    const agent = USE_KEEPALIVE ? (isHttps ? httpsAgent : httpAgent) : undefined;
    const headers = { 'Accept': '*/*', 'Connection': USE_KEEPALIVE ? 'keep-alive' : 'close' };

    const request = client.get(
      fileUrl,
      { agent, headers },
      (response) => {
        if (response.statusCode !== 200) {
          const err = new Error(`下载失败: ${response.statusCode} ${response.statusMessage}`);
          err.statusCode = response.statusCode;
          reject(err);
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        });
      }
    );

    request.on('error', (e) => {
      reject(e);
    });
    request.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
      request.destroy();
      const err = new Error('下载超时');
      err.code = 'ETIMEDOUT';
      reject(err);
    });
  });
}

// 判断是否为可重试错误
function isRetryableError(err) {
  if (!err) return false;
  if (typeof err.statusCode === 'number') {
    if (err.statusCode === 429) return true;
    if (err.statusCode >= 500 && err.statusCode < 600) return true;
  }
  const code = err.code || '';
  const msg = (err.message || '').toLowerCase();
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN' ||
    code === 'ECONNABORTED' ||
    msg.includes('socket hang up') ||
    msg.includes('timeout') ||
    msg.includes('econnreset')
  );
}

// 支持自动重试的下载
const DEFAULT_RETRIES = (() => {
  const v = parseInt(process.env.MIGRATE_RETRIES || '', 10);
  return Number.isNaN(v) ? 2 : Math.max(0, v);
})();
async function downloadFile(fileUrl) {
  let attempt = 0;
  let lastErr = null;
  while (attempt <= DEFAULT_RETRIES) {
    try {
      const buf = await doHttpDownload(fileUrl);
      return buf;
    } catch (err) {
      lastErr = err;
      const willRetry = isRetryableError(err) && attempt < DEFAULT_RETRIES;
      if (!willRetry) {
        throw err;
      }
      const delay = Math.min(1000 * Math.pow(2, attempt), BACKOFF_MAX_MS) + Math.floor(Math.random() * 300);
      console.warn(`  ⚠ 下载失败重试(${attempt + 1}/${DEFAULT_RETRIES}): ${err.message}，${delay}ms 后重试`);
      await sleep(delay);
      attempt++;
    }
  }
  throw lastErr || new Error('未知下载错误');
}

/**
 * 上传文件到 COS
 */
function uploadToCOS(buffer, key, contentType) {
  const maxRetries = DEFAULT_RETRIES;
  let attempt = 0;
  return new Promise((resolve, reject) => {
    const run = async () => {
      try {
        cos.putObject({
          Bucket: CONFIG.cos.Bucket,
          Region: CONFIG.cos.Region,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          ACL: 'public-read',
        }, async (err, data) => {
          if (err) {
            const willRetry = isRetryableError(err) && attempt < maxRetries;
            if (willRetry) {
              const delay = Math.min(1000 * Math.pow(2, attempt), BACKOFF_MAX_MS) + Math.floor(Math.random() * 300);
              console.warn(`  ⚠ 上传失败重试(${attempt + 1}/${maxRetries}): ${err.message || err.code || err}，${delay}ms 后重试`);
              attempt++;
              await sleep(delay);
              return run();
            }
            return reject(err);
          }
          return resolve(data);
        });
      } catch (e) {
        const willRetry = isRetryableError(e) && attempt < maxRetries;
        if (willRetry) {
          const delay = Math.min(1000 * Math.pow(2, attempt), BACKOFF_MAX_MS) + Math.floor(Math.random() * 300);
          console.warn(`  ⚠ 上传失败重试(${attempt + 1}/${maxRetries}): ${e.message || e}，${delay}ms 后重试`);
          attempt++;
          await sleep(delay);
          return run();
        }
        return reject(e);
      }
    };
    run();
  });
}

/**
 * 获取文件的 MIME 类型
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * 将旧/相对 URL 转成可下载的源地址
 */
function buildSourceUrl(u) {
  if (!u) return u;
  if (u.startsWith('http')) return u;
  const base = CONFIG.domains.oldDomains[0];
  return `${base}${u.startsWith('/') ? '' : '/'}${u}`;
}

/**
 * 基于 URL 生成 COS Key（保持 /uploads 前缀）
 */
function getKeyFromUrl(anyUrl) {
  try {
    const parsed = url.parse(anyUrl);
    const pathname = parsed.pathname || anyUrl; // 兼容传入相对路径
    if (pathname.startsWith('/uploads/')) return pathname.substring(1);
    return `uploads${pathname.startsWith('/') ? '' : '/'}${pathname}`;
  } catch {
    // 兜底
    const p = anyUrl.startsWith('/') ? anyUrl.slice(1) : anyUrl;
    return p.startsWith('uploads/') ? p : `uploads/${p}`;
  }
}

/**
 * 将旧 URL 或相对路径统一转换为 CDN URL
 */
function convertToCdnUrl(oldUrl) {
  if (!oldUrl) return oldUrl;
  // 绝对地址：替换域名
  for (const oldDomain of CONFIG.domains.oldDomains) {
    if (oldUrl.startsWith(oldDomain)) {
      const parsed = url.parse(oldUrl);
      return `${CONFIG.domains.newDomain}${parsed.pathname || ''}`;
    }
  }
  // 相对路径：直接加上新域名
  return `${CONFIG.domains.newDomain}${oldUrl.startsWith('/') ? '' : '/'}${oldUrl}`;
}

/**
 * 迁移单个文件
 */
function getCandidateSourceUrls(u) {
  if (!u) return [];
  const olds = CONFIG.domains.oldDomains || [];
  // 绝对 URL：若命中任一旧域名，生成替换镜像候选；若为其他域名（如 CDN），基于 pathname 回退到旧域名
  if (typeof u === 'string' && u.startsWith('http')) {
    const list = [u];
    try {
      const parsed = url.parse(u);
      const pathname = parsed.pathname || '';
      let matchedOld = false;
      for (const od of olds) {
        if (u.startsWith(od)) {
          matchedOld = true;
          for (const alt of olds) {
            if (alt !== od) list.push(u.replace(od, alt));
          }
          break;
        }
      }
      // 若不是旧域名，但 pathname 指向 uploads 资源，则拼接所有旧域名回源尝试
      if (!matchedOld && pathname && pathname.startsWith('/uploads/')) {
        for (const od of olds) {
          list.push(`${od}${pathname}`);
        }
      }
    } catch (_) {}
    return Array.from(new Set(list));
  }
  // 相对路径：拼接所有旧域名
  const pathPart = u.startsWith('/') ? u : `/${u}`;
  return olds.map((d) => `${d}${pathPart}`);
}

async function downloadWithMirror(u) {
  const candidates = getCandidateSourceUrls(u);
  let lastErr = null;
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    try {
      return await downloadFile(cand);
    } catch (e) {
      lastErr = e;
      if (LOG_LEVEL === 'debug') {
        console.debug(`  ⏭ 镜像尝试失败(${i + 1}/${candidates.length}): ${cand} -> ${e.message}`);
      }
    }
  }
  throw lastErr || new Error('所有镜像下载均失败');
}

/**
 * 主函数
 */
// 支持从环境变量或 CLI 读取 LIMIT
function getLimitFromEnvArgs() {
  const envLimit = parseInt(process.env.MIGRATE_LIMIT || '', 10);
  if (!Number.isNaN(envLimit) && envLimit > 0) return envLimit;
  const arg = process.argv.find((a) => a.startsWith('--limit='));
  if (arg) {
    const v = parseInt(arg.split('=')[1], 10);
    if (!Number.isNaN(v) && v > 0) return v;
  }
  return 0; // 0 表示不限制
}

// 新增：支持从环境变量或 CLI 读取并发度
function getConcurrencyFromEnvArgs() {
  const envC = parseInt(process.env.MIGRATE_CONCURRENCY || '', 10);
  if (!Number.isNaN(envC) && envC > 0) return envC;
  const arg = process.argv.find((a) => a.startsWith('--concurrency='));
  if (arg) {
    const v = parseInt(arg.split('=')[1], 10);
    if (!Number.isNaN(v) && v > 0) return v;
  }
  return 3; // 默认并发 3，更快且相对稳妥
}

// 新增：并发控制的任务执行器
async function runWithConcurrency(items, limit, handler) {
  let index = 0;
  const total = items.length;
  const results = new Array(total);
  const workers = Array.from({ length: Math.min(limit, total) }, async () => {
    while (true) {
      const current = index++;
      if (current >= total) break;
      const item = items[current];
      try {
        results[current] = await handler(item, current);
      } catch (err) {
        results[current] = { success: false, error: err?.message || String(err) };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log('🚀 开始媒体文件迁移到腾讯云 COS...\n');
  const LIMIT = getLimitFromEnvArgs();
  if (LIMIT > 0) {
    console.log(`🔎 本次将仅试跑前 ${LIMIT} 条记录`);
  }
  const CONCURRENCY = getConcurrencyFromEnvArgs();
  console.log(`⚙ 使用并发: ${CONCURRENCY}`);

  // 验证配置
  if (!CONFIG.cos.SecretId || !CONFIG.cos.SecretKey || !CONFIG.cos.Bucket || !CONFIG.cos.Region) {
    const required = ['TENCENT_COS_SECRET_ID','TENCENT_COS_SECRET_KEY','TENCENT_COS_BUCKET','TENCENT_COS_REGION'];
    const missing = required.filter((k) => !process.env[k]);
    console.error('❌ 腾讯云 COS 配置不完整，请检查环境变量，缺少: ' + (missing.join(', ') || '未知'));
    process.exit(1);
  }

  try {
    // 测试数据库连接
    await pool.query('SELECT 1');
    console.log('✓ 数据库连接成功');

    // 自动探测上传表
    UPLOAD_TABLE = await findUploadTable(pool, SCHEMA);
    if (!UPLOAD_TABLE) {
      console.error(`❌ 无法找到包含媒体文件(url/mime/formats/provider)列的上传表。请确认 schema=${SCHEMA} 下存在相关表。\n` +
        `可用以下 SQL 排查: \n` +
        `  SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema='${SCHEMA}' ORDER BY 1,2;\n` +
        `或设置环境变量 DATABASE_SCHEMA 指定正确的 schema。`);
      process.exit(1);
    }
    console.log(`✓ 检测到上传表: ${UPLOAD_TABLE}`);

    // 查询需要迁移的文件（按创建时间倒序，可选 LIMIT）
    let query = `
      SELECT id, name, url, mime, size, formats, provider
      FROM ${UPLOAD_TABLE}
      WHERE provider != 'strapi-provider-upload-tencent-cloud-cos'
         OR url LIKE $1 OR url LIKE $2 OR url LIKE '/uploads/%'
      ORDER BY created_at DESC
    `;
    if (LIMIT > 0) {
      query += ` LIMIT ${LIMIT}`;
    }

    const result = await pool.query(query, [
      `%${CONFIG.domains.oldDomains[0]}%`,
      `%${CONFIG.domains.oldDomains[1] || 'nonexistent'}%`
    ]);

    const files = result.rows;
    console.log(`\n📊 找到 ${files.length} 个文件需要迁移\n`);

    if (files.length === 0) {
      console.log('🎉 没有文件需要迁移！');
      return;
    }

    // 使用并发迁移文件
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    await runWithConcurrency(files, CONCURRENCY, async (file, idx) => {
      console.log(`\n[${idx + 1}/${files.length}] 处理文件: ${file.name}`);
      const result = await migrateFile(file);
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({
          fileId: result.fileId,
          fileName: file.name,
          error: result.error
        });
      }
      return result;
    });

    // 输出迁移结果
    console.log('\n📈 迁移完成！');
    console.log(`✓ 成功: ${results.success} 个文件`);
    console.log(`❌ 失败: ${results.failed} 个文件`);

    if (results.errors.length > 0) {
      console.log('\n失败的文件详情:');
      results.errors.forEach(error => {
        console.log(`  - ${error.fileName} (ID: ${error.fileId}): ${error.error}`);
      });
    }

    console.log('\n🎉 迁移脚本执行完成！');
    console.log('建议：');
    console.log('1. 访问前台页面验证图片是否正常显示');
    console.log('2. 检查 Strapi 后台媒体库是否工作正常');
    console.log('3. 如果一切正常，可以考虑清理旧的 Railway 媒体文件');

  } catch (error) {
    console.error('❌ 迁移过程中发生错误:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 运行脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };

async function migrateFile(fileRecord) {
  if (!UPLOAD_TABLE) {
    throw new Error('UPLOAD_TABLE is not defined');
  }
  console.log(`\n正在迁移文件: ${fileRecord.name} (ID: ${fileRecord.id})`);

  try {
    const mainUrl = fileRecord.url;
    const formats = fileRecord.formats || {};

    // 仅当 provider 不是 COS 时才需要迁移
    const shouldMigrate = fileRecord.provider !== 'strapi-provider-upload-tencent-cloud-cos';

    // 存储需要更新的 URL 映射
    let newMainUrl = null;
    const updatedFormats = { ...formats };

    if (shouldMigrate) {
      // 迁移主文件
      const fullUrl = buildSourceUrl(mainUrl);
      console.log(`  下载主文件: ${fullUrl}`);
      const buffer = await downloadWithMirror(mainUrl);
      const key = getKeyFromUrl(fullUrl);
      const contentType = getMimeType(fullUrl);
      console.log(`  上传到 COS: ${key}`);
      await uploadToCOS(buffer, key, contentType);
      newMainUrl = convertToCdnUrl(mainUrl);
      console.log(`  ✓ 主文件迁移成功: ${newMainUrl}`);

      // 迁移各种格式（并发）
      const entries = Object.entries(formats);
      if (entries.length > 0) {
        await runWithConcurrency(entries, FORMATS_CONCURRENCY, async ([formatName, formatData]) => {
          if (!(formatData && formatData.url)) return null;
          const fUrl = formatData.url;
          const fFull = buildSourceUrl(fUrl);
          console.log(`  下载 ${formatName}: ${fFull}`);
          try {
            const fBuf = await downloadWithMirror(fUrl);
            const fKey = getKeyFromUrl(fFull);
            const fType = getMimeType(fFull);
            console.log(`  上传 ${formatName} 到 COS: ${fKey}`);
            await uploadToCOS(fBuf, fKey, fType);
            updatedFormats[formatName] = { ...formatData, url: convertToCdnUrl(fUrl) };
            console.log(`  ✓ ${formatName} 迁移成功: ${updatedFormats[formatName].url}`);
          } catch (err) {
            console.warn(`  ⚠ ${formatName} 迁移失败: ${err.message}`);
          }
          return null;
        });
      }
    }

    // 更新数据库记录
    if (shouldMigrate) {
      const updateQuery = `
        UPDATE ${UPLOAD_TABLE} 
        SET 
          url = COALESCE($1, url),
          formats = COALESCE($2, formats),
          provider = 'strapi-provider-upload-tencent-cloud-cos',
          updated_at = NOW()
        WHERE id = $3
      `;

      await pool.query(updateQuery, [
        newMainUrl || null,
        Object.keys(updatedFormats).length > 0 ? JSON.stringify(updatedFormats) : null,
        fileRecord.id
      ]);
      console.log(`  ✓ 数据库记录已更新`);
    }

    return { success: true, fileId: fileRecord.id };
  } catch (error) {
    console.error(`  ❌ 迁移失败: ${error.message}`);
    return { success: false, fileId: fileRecord.id, error: error.message };
  }
}