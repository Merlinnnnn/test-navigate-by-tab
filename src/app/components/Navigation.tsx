'use client';

import React from 'react';
import { Layout, Menu, Button, Space } from 'antd';
import { CalendarOutlined, MessageOutlined, HomeOutlined } from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const { Header } = Layout;

const Navigation: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: 'Trang chủ',
    },
    {
      key: '/tracking',
      icon: <CalendarOutlined />,
      label: 'Tracking Calendar',
    },
    {
      key: '/cad-view',
      icon: <MessageOutlined />,
      label: 'CAD Viewer',
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    router.push(key);
  };

  return (
    <Header style={{ 
      display: 'flex', 
      alignItems: 'center', 
      background: '#fff',
      borderBottom: '1px solid #f0f0f0',
      padding: '0 24px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        width: '100%' 
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px' 
        }}>
          <Link href="/" style={{ 
            fontSize: '20px', 
            fontWeight: 'bold', 
            color: '#1890ff',
            textDecoration: 'none'
          }}>
            Table Navigate
          </Link>
          <Menu
            mode="horizontal"
            selectedKeys={[pathname]}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ 
              border: 'none', 
              background: 'transparent',
              minWidth: '400px'
            }}
          />
        </div>
      </div>
    </Header>
  );
};

export default Navigation;
