import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

type InputProps = {
  name: string;
  value?: number | null;
  onChange: (e: { target: { name: string; value: number | null; type?: string } }) => void;
  attribute?: any;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string | null;
  intlLabel?: { id?: string; defaultMessage?: string };
  description?: { id?: string; defaultMessage?: string };
};

interface Category {
  id: number;
  name: string;
  slug: string;
  parent_category?: Category | null;
  children_categories?: Category[];
}

interface CategoryNode extends Category {
  children: CategoryNode[];
  level: number;
}

const Input: React.FC<InputProps> = (props) => {
  const { name, value, onChange, disabled, placeholder, required } = props;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  // 获取分类数据
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories?populate=*&pagination[limit]=1000');
        const data = await response.json();
        setCategories(data.data || []);
        
        // 如果有选中值，找到对应的分类
        if (value && data.data) {
          const selected = data.data.find((cat: Category) => cat.id === value);
          setSelectedCategory(selected || null);
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [value]);

  // 构建层级树结构
  const categoryTree = useMemo(() => {
    const buildTree = (cats: Category[], parentId: number | null = null, level = 0): CategoryNode[] => {
      return cats
        .filter(cat => {
          const parentCatId = cat.parent_category?.id || null;
          return parentCatId === parentId;
        })
        .map(cat => ({
          ...cat,
          children: buildTree(cats, cat.id, level + 1),
          level
        }));
    };

    return buildTree(categories);
  }, [categories]);

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    onChange({ target: { name, value: category.id, type: 'select' } });
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedCategory(null);
    onChange({ target: { name, value: null, type: 'select' } });
  };

  const toggleExpand = (categoryId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderCategoryNode = (node: CategoryNode): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedCategory?.id === node.id;

    return (
      <div key={node.id}>
        <div
          className={`category-item ${
            isSelected ? 'selected' : ''
          }`}
          style={{
            paddingLeft: `${node.level * 20 + 12}px`,
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: isSelected ? '#f0f8ff' : 'transparent',
            borderLeft: isSelected ? '3px solid #4945ff' : '3px solid transparent',
          }}
          onClick={() => handleCategorySelect(node)}
        >
          {hasChildren && (
            <button
              type="button"
              onClick={(e) => toggleExpand(node.id, e)}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px',
                marginRight: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </button>
          )}
          {!hasChildren && <div style={{ width: '20px' }} />}
          <span style={{ fontSize: '14px', color: '#32324d' }}>
            {node.name}
          </span>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderCategoryNode(child))}
          </div>
        )}
      </div>
    );
  };

  const labelText = props?.intlLabel?.defaultMessage || props?.attribute?.label || name;
  const hintText = props?.description?.defaultMessage || props?.attribute?.description || '';

  if (loading) {
    return (
      <div>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 12, color: '#32324d' }}>
          {labelText}{required ? ' *' : ''}
        </label>
        <div style={{ padding: '12px', border: '1px solid #dcdce4', borderRadius: '4px', color: '#666' }}>
          加载分类中...
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Label */}
      <label
        style={{
          display: 'block',
          marginBottom: 6,
          fontWeight: 600,
          fontSize: 12,
          color: '#32324d',
        }}
      >
        {labelText}{required ? ' *' : ''}
      </label>

      {/* Selected Value Display */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          padding: '12px',
          border: '1px solid #dcdce4',
          borderRadius: '4px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          backgroundColor: disabled ? '#f6f6f9' : '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: '40px',
        }}
      >
        <span style={{ color: selectedCategory ? '#32324d' : '#8e8ea9' }}>
          {selectedCategory ? selectedCategory.name : (placeholder || '选择分类')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {selectedCategory && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#666',
                cursor: 'pointer',
                padding: '2px',
              }}
            >
              ✕
            </button>
          )}
          <ChevronDown 
            size={16} 
            style={{ 
              color: '#8e8ea9',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s'
            }} 
          />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: '#ffffff',
            border: '1px solid #dcdce4',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          {categoryTree.length === 0 ? (
            <div style={{ padding: '12px', color: '#666', textAlign: 'center' }}>
              暂无分类数据
            </div>
          ) : (
            categoryTree.map(node => renderCategoryNode(node))
          )}
        </div>
      )}

      {/* Hint */}
      {hintText && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#666687' }}>
          {hintText}
        </div>
      )}
    </div>
  );
};

export default Input;