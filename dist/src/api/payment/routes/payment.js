"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    routes: [
        // 默认CRUD路由
        {
            method: 'GET',
            path: '/payments',
            handler: 'payment.find',
        },
        {
            method: 'GET',
            path: '/payments/:id',
            handler: 'payment.findOne',
        },
        {
            method: 'POST',
            path: '/payments',
            handler: 'payment.create',
        },
        {
            method: 'PUT',
            path: '/payments/:id',
            handler: 'payment.update',
        },
        {
            method: 'DELETE',
            path: '/payments/:id',
            handler: 'payment.delete',
        },
        // Stripe支付相关路由
        {
            method: 'POST',
            path: '/payments/create-checkout-session',
            handler: 'payment.createCheckoutSession',
            config: {
                auth: false, // 允许未登录用户创建支付会话
            },
        },
        // webhook路由现在在bootstrap中直接处理
        {
            method: 'GET',
            path: '/payments/session/:sessionId',
            handler: 'payment.getSessionDetails',
            config: {
                auth: false, // 允许查看支付会话详情
            },
        },
    ],
};
