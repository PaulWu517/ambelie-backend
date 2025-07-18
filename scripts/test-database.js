/**
 * 数据库连接测试脚本
 * 用于诊断数据库连接问题
 * 
 * 使用方法：
 * node scripts/test-database.js
 */

const { Client } = require('pg');
require('dotenv').config();

async function testDatabaseConnection() {
  console.log('🔍 开始数据库连接测试...');
  console.log('=====================================');
  
  // 检查环境变量
  console.log('📋 环境变量检查:');
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? '已设置' : '未设置'}`);
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL 环境变量未设置');
    process.exit(1);
  }
  
  // 解析数据库URL
  let dbConfig;
  try {
    const url = new URL(process.env.DATABASE_URL);
    dbConfig = {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1),
      user: url.username,
      password: url.password,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'true'
      } : false
    };
    
    console.log('🔗 数据库配置:');
    console.log(`主机: ${dbConfig.host}`);
    console.log(`端口: ${dbConfig.port}`);
    console.log(`数据库: ${dbConfig.database}`);
    console.log(`用户: ${dbConfig.user}`);
    console.log(`SSL: ${dbConfig.ssl ? '启用' : '禁用'}`);
    
  } catch (error) {
    console.error('❌ DATABASE_URL 格式错误:', error.message);
    process.exit(1);
  }
  
  // 测试连接
  const client = new Client(dbConfig);
  
  try {
    console.log('\n🔌 尝试连接数据库...');
    const startTime = Date.now();
    
    await client.connect();
    const connectTime = Date.now() - startTime;
    console.log(`✅ 数据库连接成功 (${connectTime}ms)`);
    
    // 测试基本查询
    console.log('\n🧪 执行测试查询...');
    const queryStartTime = Date.now();
    
    const result = await client.query('SELECT version(), now() as current_time');
    const queryTime = Date.now() - queryStartTime;
    
    console.log(`✅ 查询执行成功 (${queryTime}ms)`);
    console.log(`数据库版本: ${result.rows[0].version}`);
    console.log(`当前时间: ${result.rows[0].current_time}`);
    
    // 检查表是否存在
    console.log('\n📊 检查核心表结构...');
    const tables = ['orders', 'payments', 'products', 'order_items'];
    
    for (const table of tables) {
      try {
        const tableResult = await client.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
          [table]
        );
        const exists = tableResult.rows[0].exists;
        console.log(`${exists ? '✅' : '❌'} 表 '${table}': ${exists ? '存在' : '不存在'}`);
      } catch (error) {
        console.log(`❌ 检查表 '${table}' 时出错: ${error.message}`);
      }
    }
    
    // 测试连接池
    console.log('\n🏊 测试连接池性能...');
    const poolTestStart = Date.now();
    const promises = [];
    
    for (let i = 0; i < 5; i++) {
      promises.push(client.query('SELECT $1 as test_value', [i]));
    }
    
    await Promise.all(promises);
    const poolTestTime = Date.now() - poolTestStart;
    console.log(`✅ 并发查询测试完成 (${poolTestTime}ms)`);
    
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    console.error('错误详情:', error);
    
    // 提供故障排除建议
    console.log('\n🔧 故障排除建议:');
    
    if (error.code === 'ENOTFOUND') {
      console.log('- 检查数据库主机地址是否正确');
      console.log('- 确认网络连接正常');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('- 检查数据库服务是否运行');
      console.log('- 确认端口号是否正确');
    } else if (error.code === '28P01') {
      console.log('- 检查用户名和密码是否正确');
    } else if (error.code === '3D000') {
      console.log('- 检查数据库名称是否正确');
    } else {
      console.log('- 检查 DATABASE_URL 格式是否正确');
      console.log('- 确认数据库服务提供商的连接限制');
      console.log('- 检查防火墙设置');
    }
    
    process.exit(1);
  } finally {
    await client.end();
  }
  
  console.log('\n🎉 数据库连接测试完成!');
}

// 运行测试
testDatabaseConnection().catch(console.error);