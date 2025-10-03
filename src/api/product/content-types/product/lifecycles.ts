export default {
  // 在创建产品前同步category字段
  async beforeCreate(event) {
    const { data } = event.params;
    
    if (data.category && !data.categoryRelation) {
      data.categoryRelation = data.category;
    }
  },

  // 在更新产品前同步category字段
  async beforeUpdate(event) {
    const { data } = event.params;
    
    if (data.category !== undefined) {
      data.categoryRelation = data.category;
    }
  },

  // 在查找后填充category字段
  async afterFindOne(event) {
    const { result } = event;
    
    if (result && result.categoryRelation && !result.category) {
      result.category = result.categoryRelation.id;
    }
  },

  // 在查找多个后填充category字段
  async afterFindMany(event) {
    const { result } = event;
    
    if (result && Array.isArray(result)) {
      result.forEach(item => {
        if (item.categoryRelation && !item.category) {
          item.category = item.categoryRelation.id;
        }
      });
    }
  }
};