"use client";
import React, { useState, useRef, useEffect } from "react";
import { Input, Button, Space, Menu, Typography } from "antd";
import { SendOutlined, UserOutlined, FileOutlined, TeamOutlined } from "@ant-design/icons";

type PI = {
  id: string;
  title: string;
  status: string;
};

type MentionInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  pis: PI[];
};

const MentionInput: React.FC<MentionInputProps> = ({ value, onChange, onSend, pis }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [mentionType, setMentionType] = useState<'PI' | 'file' | 'people' | null>(null);
  const [selectedPi, setSelectedPi] = useState<PI | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const inputRef = useRef<any>(null);

  const users = ['trongtri', 'anhkhoa', 'kimngan', 'manager', 'developer'];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target)) {
        setShowDropdown(false);
        setShowUserDropdown(false);
        setMentionType(null);
        setSelectedPi(null);
        setMentionStart(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Check for @ symbol
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Check if @ is not part of a word (has space or start of line before it)
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      if (charBeforeAt !== ' ' && charBeforeAt !== '\n') {
        setShowDropdown(false);
        setShowUserDropdown(false);
        setMentionType(null);
        setSelectedPi(null);
        setMentionStart(-1);
        return;
      }

      setMentionStart(lastAtIndex);
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // If just @, show mention type options
      if (textAfterAt === '') {
        setMentionType(null);
        setShowDropdown(true);
        setShowUserDropdown(false);
        updateDropdownPosition(e.target, lastAtIndex);
      }
      // If @PI, show PI options
      else if (textAfterAt === 'PI') {
        setMentionType('PI');
        setShowDropdown(true);
        setShowUserDropdown(false);
        updateDropdownPosition(e.target, lastAtIndex);
      }
      // If @PI:PI-ID(, show user options
      else if (textAfterAt.match(/^PI:[A-Za-z0-9-]+\($/)) {
        const piMatch = textAfterAt.match(/^PI:([A-Za-z0-9-]+)\($/);
        if (piMatch) {
          const piId = piMatch[1];
          const pi = pis.find(p => p.id === piId);
          if (pi) {
            setSelectedPi(pi);
            setShowUserDropdown(true);
            setShowDropdown(false);
            updateDropdownPosition(e.target, lastAtIndex);
          }
        }
      }
      else {
        setShowDropdown(false);
        setShowUserDropdown(false);
        setMentionType(null);
        setSelectedPi(null);
        setMentionStart(-1);
      }
    } else {
      setShowDropdown(false);
      setShowUserDropdown(false);
      setMentionType(null);
      setSelectedPi(null);
      setMentionStart(-1);
    }
  };

  const updateDropdownPosition = (element: HTMLTextAreaElement, atIndex: number) => {
    const rect = element.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 5,
      left: rect.left + atIndex * 8 // Approximate character width
    });
  };

  const insertMention = (type: string, data?: any) => {
    if (mentionStart === -1) return;

    const textBeforeMention = value.substring(0, mentionStart);
    const textAfterCursor = value.substring(inputRef.current?.resizableTextArea?.textArea?.selectionStart || 0);
    
    let replacement = '';
    
    if (type === 'PI') {
      replacement = `@PI:${data.id}(${data.username})`;
    } else if (type === 'file') {
      replacement = `@file:${data}`;
    } else if (type === 'people') {
      replacement = `@people:${data}`;
    }

    const newValue = textBeforeMention + replacement + textAfterCursor;
    onChange(newValue);

    setShowDropdown(false);
    setShowUserDropdown(false);
    setMentionType(null);
    setSelectedPi(null);
    setMentionStart(-1);
  };

  const mentionTypeMenu = (
    <Menu
      onClick={({ key }) => {
        if (key === 'PI') {
          setMentionType('PI');
        } else if (key === 'file') {
          insertMention('file', 'document.pdf');
        } else if (key === 'people') {
          insertMention('people', 'team');
        }
      }}
    >
      <Menu.Item key="PI" icon={<TeamOutlined />}>
        PI
      </Menu.Item>
      <Menu.Item key="file" icon={<FileOutlined />}>
        File
      </Menu.Item>
      <Menu.Item key="people" icon={<UserOutlined />}>
        People
      </Menu.Item>
    </Menu>
  );

  const piMenu = (
    <Menu
      onClick={({ key }) => {
        const pi = pis.find(p => p.id === key);
        if (pi) {
          setSelectedPi(pi);
          setShowUserDropdown(true);
          setShowDropdown(false);
        }
      }}
    >
      {pis.map(pi => (
        <Menu.Item key={pi.id}>
          <Space>
            <Typography.Text strong>{pi.id}</Typography.Text>
            <Typography.Text type="secondary">{pi.title}</Typography.Text>
          </Space>
        </Menu.Item>
      ))}
    </Menu>
  );

  const userMenu = (
    <Menu
      onClick={({ key }) => {
        if (selectedPi) {
          insertMention('PI', { id: selectedPi.id, username: key });
        }
      }}
    >
      {users.map(user => (
        <Menu.Item key={user} icon={<UserOutlined />}>
          {user}
        </Menu.Item>
      ))}
    </Menu>
  );

  return (
    <div style={{ position: 'relative' }} ref={inputRef}>
      <Input.TextArea
        value={value}
        onChange={handleInputChange}
        placeholder="Nhập tin nhắn... (sử dụng @ để mention)"
        autoSize={{ minRows: 3, maxRows: 6 }}
        style={{ marginBottom: '8px' }}
      />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
          Sử dụng @PI để mention PI, @file để mention file, @people để mention người
        </Typography.Text>
        <Button type="primary" icon={<SendOutlined />} onClick={onSend}>
          Gửi
        </Button>
      </div>

      {showDropdown && (
        <div
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 1000,
            background: '#fff',
            border: '1px solid #d9d9d9',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: '150px'
          }}
        >
          {mentionType === null ? mentionTypeMenu : piMenu}
        </div>
      )}

      {showUserDropdown && (
        <div
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 1000,
            background: '#fff',
            border: '1px solid #d9d9d9',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: '120px'
          }}
        >
          {userMenu}
        </div>
      )}
    </div>
  );
};

export default MentionInput;
