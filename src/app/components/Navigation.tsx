'use client';

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Layout, Menu, Button, Space } from 'antd';
import { CalendarOutlined, MessageOutlined, HomeOutlined } from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const { Header } = Layout;

const Navigation: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const renderCountRef = useRef(0);
  const prevPathnameRef = useRef<string | null>(null);
  const prevSelectedKeysRef = useRef<string[]>([]);

  // Log render
  renderCountRef.current += 1;
  if (renderCountRef.current > 10) {
    console.warn('[Navigation] WARNING: Component rendered more than 10 times! This might indicate an infinite loop.', {
      renderCount: renderCountRef.current,
      pathname,
      selectedKeys,
      prevPathname: prevPathnameRef.current,
      prevSelectedKeys: prevSelectedKeysRef.current
    });
  }
  console.log('[Navigation] Render #' + renderCountRef.current, {
    pathname,
    selectedKeys,
    prevPathname: prevPathnameRef.current,
    prevSelectedKeys: prevSelectedKeysRef.current,
    timestamp: new Date().toISOString()
  });

  const menuItems = useMemo(() => {
    console.log('[Navigation] menuItems useMemo called');
    return [
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
  }, []);

  // Update selectedKeys only when pathname changes
  useEffect(() => {
    console.log('[Navigation] useEffect triggered', {
      pathname,
      prevPathname: prevPathnameRef.current,
      pathnameChanged: pathname !== prevPathnameRef.current,
      currentSelectedKeys: selectedKeys
    });

    // Only update if pathname actually changed
    if (pathname === prevPathnameRef.current) {
      console.log('[Navigation] pathname unchanged, skipping update');
      return;
    }

    if (pathname) {
      const normalizedPath = pathname === '/' ? '/' : pathname;
      const newSelectedKeys = [normalizedPath];
      
      // Only update if actually changed
      if (JSON.stringify(newSelectedKeys) !== JSON.stringify(prevSelectedKeysRef.current)) {
        console.log('[Navigation] Updating selectedKeys', {
          from: prevSelectedKeysRef.current,
          to: newSelectedKeys
        });
        setSelectedKeys(newSelectedKeys);
        prevSelectedKeysRef.current = newSelectedKeys;
      } else {
        console.log('[Navigation] selectedKeys unchanged, skipping update');
      }
    } else {
      if (prevSelectedKeysRef.current.length > 0) {
        console.log('[Navigation] Clearing selectedKeys');
        setSelectedKeys([]);
        prevSelectedKeysRef.current = [];
      }
    }
    
    prevPathnameRef.current = pathname;
  }, [pathname]); // Only depend on pathname, not selectedKeys

  const handleMenuClick = useCallback(({ key }: { key: string }) => {
    console.log('[Navigation] handleMenuClick called', {
      key,
      currentPathname: pathname,
      willNavigate: key !== pathname
    });
    
    if (key !== pathname) {
      router.push(key);
    } else {
      console.log('[Navigation] Already on this page, skipping navigation');
    }
  }, [router, pathname]);

  // Memoize style objects to prevent re-renders
  const headerStyle = useMemo(() => ({
    display: 'flex' as const,
    alignItems: 'center' as const,
    background: '#fff',
    borderBottom: '1px solid #f0f0f0',
    padding: '0 24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
  }), []);

  const containerStyle = useMemo(() => ({
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    width: '100%'
  }), []);

  const innerContainerStyle = useMemo(() => ({
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '16px'
  }), []);

  const linkStyle = useMemo(() => ({
    fontSize: '20px',
    fontWeight: 'bold' as const,
    color: '#1890ff',
    textDecoration: 'none' as const
  }), []);

  const menuStyle = useMemo(() => ({
    border: 'none' as const,
    background: 'transparent' as const,
    minWidth: '400px'
  }), []);

  console.log('[Navigation] Rendering Menu with props', {
    selectedKeys,
    menuItemsLength: menuItems.length,
    menuStyle,
    hasOnClick: !!handleMenuClick
  });

  return (
    <Header style={headerStyle}>
      <div style={containerStyle}>
        <div style={innerContainerStyle}>
          <Link href="/" style={linkStyle}>
            Table Navigate
          </Link>
          <Menu
            mode="horizontal"
            selectedKeys={selectedKeys}
            items={menuItems}
            onClick={handleMenuClick}
            style={menuStyle}
            triggerSubMenuAction="click"
          />
        </div>
      </div>
    </Header>
  );
};

export default Navigation;
