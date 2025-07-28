/**
 * 测试新创建的API端点
 * 运行命令: node test-new-apis.js
 */

const API_BASE_URL = 'http://localhost:1337/api';

// 测试用的模拟数据
const testProduct = {
  id: 'test-product-1',
  name: 'Test Product',
  price: 99.99,
  image: 'https://example.com/image.jpg'
};

const testToken = 'test-user-token'; // 在实际测试中需要真实的用户token

// 辅助函数：发送API请求
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testToken}`
    }
  };
  
  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  };
  
  console.log(`\n🔄 ${finalOptions.method || 'GET'} ${url}`);
  
  try {
    const response = await fetch(url, finalOptions);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ 成功: ${response.status}`);
      console.log('响应数据:', JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ 失败: ${response.status}`);
      console.log('错误信息:', JSON.stringify(data, null, 2));
    }
    
    return { success: response.ok, data, status: response.status };
  } catch (error) {
    console.log(`💥 请求异常:`, error.message);
    return { success: false, error: error.message };
  }
}

// 测试购物车API
async function testCartAPI() {
  console.log('\n🛒 ===== 测试购物车API =====');
  
  // 1. 获取购物车
  await apiRequest('/cart');
  
  // 2. 添加商品到购物车
  await apiRequest('/cart/add', {
    method: 'POST',
    body: JSON.stringify({
      productId: testProduct.id,
      quantity: 2
    })
  });
  
  // 3. 更新购物车商品数量
  await apiRequest('/cart/update', {
    method: 'PUT',
    body: JSON.stringify({
      productId: testProduct.id,
      quantity: 3
    })
  });
  
  // 4. 同步购物车
  await apiRequest('/cart/sync', {
    method: 'POST',
    body: JSON.stringify({
      items: [{
        productId: testProduct.id,
        quantity: 1,
        product: testProduct
      }]
    })
  });
  
  // 5. 从购物车移除商品
  await apiRequest(`/cart/remove/${testProduct.id}`, {
    method: 'DELETE'
  });
  
  // 6. 清空购物车
  await apiRequest('/cart/clear', {
    method: 'DELETE'
  });
}

// 测试询价API
async function testInquiryAPI() {
  console.log('\n💬 ===== 测试询价API =====');
  
  // 1. 获取询价列表
  await apiRequest('/inquiries');
  
  // 2. 添加商品到询价
  await apiRequest('/inquiries/add', {
    method: 'POST',
    body: JSON.stringify({
      productId: testProduct.id,
      quantity: 1
    })
  });
  
  // 3. 同步询价列表
  await apiRequest('/inquiries/sync', {
    method: 'POST',
    body: JSON.stringify({
      items: [{
        productId: testProduct.id,
        quantity: 2,
        product: testProduct
      }]
    })
  });
  
  // 4. 提交询价
  await apiRequest('/inquiries/submit', {
    method: 'POST',
    body: JSON.stringify({
      customerInfo: {
        name: 'Test User',
        email: 'test@example.com',
        phone: '+1234567890'
      },
      message: 'This is a test inquiry'
    })
  });
  
  // 5. 从询价移除商品
  await apiRequest(`/inquiries/remove/${testProduct.id}`, {
    method: 'DELETE'
  });
  
  // 6. 清空询价
  await apiRequest('/inquiries/clear', {
    method: 'DELETE'
  });
}

// 测试收藏API
async function testWishlistAPI() {
  console.log('\n❤️ ===== 测试收藏API =====');
  
  // 1. 获取收藏列表
  await apiRequest('/wishlist');
  
  // 2. 添加商品到收藏
  await apiRequest('/wishlist/add', {
    method: 'POST',
    body: JSON.stringify({
      productId: testProduct.id
    })
  });
  
  // 3. 检查商品收藏状态
  await apiRequest(`/wishlist/check/${testProduct.id}`);
  
  // 4. 同步收藏列表
  await apiRequest('/wishlist/sync', {
    method: 'POST',
    body: JSON.stringify({
      productIds: [testProduct.id]
    })
  });
  
  // 5. 从收藏移除商品
  await apiRequest(`/wishlist/remove/${testProduct.id}`, {
    method: 'DELETE'
  });
  
  // 6. 清空收藏
  await apiRequest('/wishlist/clear', {
    method: 'DELETE'
  });
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始测试新的API端点...');
  console.log('📍 API基础URL:', API_BASE_URL);
  console.log('🔑 使用测试Token:', testToken);
  
  try {
    // 首先检查服务器是否运行
    console.log('\n🏥 ===== 检查服务器状态 =====');
    const healthCheck = await apiRequest('/health/ping', { headers: {} });
    
    if (!healthCheck.success) {
      console.log('❌ 服务器未运行，请先启动Strapi服务器: npm run develop');
      return;
    }
    
    // 运行所有API测试
    await testCartAPI();
    await testInquiryAPI();
    await testWishlistAPI();
    
    console.log('\n🎉 ===== 测试完成 =====');
    console.log('📝 注意: 某些API可能因为缺少有效的用户认证而返回错误，这是正常的。');
    console.log('🔧 在实际使用中，请确保用户已登录并提供有效的认证token。');
    
  } catch (error) {
    console.error('💥 测试过程中发生错误:', error);
  }
}

// 运行测试
if (require.main === module) {
  runTests();
}

module.exports = {
  testCartAPI,
  testInquiryAPI,
  testWishlistAPI,
  runTests
};