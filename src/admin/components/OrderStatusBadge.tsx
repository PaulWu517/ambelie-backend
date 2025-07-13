import React from 'react';

interface OrderStatusBadgeProps {
  status: string;
}

const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { color: '#8c8c8c', label: '待处理' };
      case 'confirmed':
        return { color: '#1890ff', label: '已确认' };
      case 'paid':
        return { color: '#52c41a', label: '已支付' };
      case 'processing':
        return { color: '#722ed1', label: '处理中' };
      case 'shipped':
        return { color: '#13c2c2', label: '已发货' };
      case 'delivered':
        return { color: '#52c41a', label: '已送达' };
      case 'completed':
        return { color: '#52c41a', label: '已完成' };
      case 'cancelled':
        return { color: '#f5222d', label: '已取消' };
      case 'refunded':
        return { color: '#faad14', label: '已退款' };
      default:
        return { color: '#8c8c8c', label: status };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span
      style={{
        backgroundColor: config.color,
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 'bold',
      }}
    >
      {config.label}
    </span>
  );
};

export default OrderStatusBadge; 