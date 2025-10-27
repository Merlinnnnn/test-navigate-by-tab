"use client";
import React, { useState } from "react";
import { List, Avatar, Typography, Tag, Space, Button, Input, Card } from "antd";
import { UserOutlined, SendOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import MentionInput from "../components/MentionInput";

// Mock data
const PIS = [
  { id: 'PI-3023', title: 'Improve file sharing flow', status: 'In Progress' },
  { id: 'PI-1199', title: 'Refactor chat composer', status: 'Todo' },
  { id: 'PI-4501', title: 'Implement stair-climb RL', status: 'Done' }
];

const MESSAGES = [
  { id: 'm1', text: 'Giao @PI:PI-3023(trongtri) trước 5h nhé', author: 'trongtri', time: '10:30' },
  { id: 'm2', text: 'Nhớ review @PI:PI-1199(anhkhoa) hôm nay', author: 'anhkhoa', time: '11:15' },
  { id: 'm3', text: 'Done @PI:PI-4501(kimngan)', author: 'kimngan', time: '14:20' },
  { id: 'm4', text: 'Cần update @PI:PI-3023(trongtri) về progress', author: 'manager', time: '15:45' }
];

type Message = {
  id: string;
  text: string;
  author: string;
  time: string;
};

type Mention = {
  piId: string;
  username: string;
  start: number;
  end: number;
};

// Parse mentions from text using regex
const parseMentions = (text: string): Mention[] => {
  const regex = /@PI:([A-Za-z0-9-]+)\(([a-z0-9_.-]+)\)/g;
  const mentions: Mention[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    mentions.push({
      piId: match[1],
      username: match[2],
      start: match.index,
      end: match.index + match[0].length
    });
  }

  return mentions;
};

// Render text with mentions as components
const renderWithMentions = (text: string, onMentionClick: (piId: string) => void) => {
  const mentions = parseMentions(text);
  
  if (mentions.length === 0) {
    return <span>{text}</span>;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  mentions.forEach((mention, index) => {
    // Add text before mention
    if (mention.start > lastIndex) {
      parts.push(
        <span key={`text-${index}`}>
          {text.slice(lastIndex, mention.start)}
        </span>
      );
    }

    // Add mention tag
    parts.push(
      <Tag
        key={`mention-${index}`}
        className="pi-mention"
        onClick={() => onMentionClick(mention.piId)}
        style={{ cursor: 'pointer', margin: '0 2px' }}
      >
        {mention.piId} @{mention.username}
      </Tag>
    );

    lastIndex = mention.end;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(
      <span key="text-end">
        {text.slice(lastIndex)}
      </span>
    );
  }

  return <span>{parts}</span>;
};

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(MESSAGES);
  const [newMessage, setNewMessage] = useState('');

  const handleMentionClick = (piId: string) => {
    router.push(`/pi/${piId}`);
  };

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      const message: Message = {
        id: `m${Date.now()}`,
        text: newMessage,
        author: 'me',
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, message]);
      setNewMessage('');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <Card title="Chat với PI Mentions" style={{ marginBottom: '20px' }}>
        <div style={{ height: '400px', overflowY: 'auto', border: '1px solid #f0f0f0', padding: '16px', borderRadius: '8px', backgroundColor: '#fafafa' }}>
          <List
            dataSource={messages}
            renderItem={(message) => (
              <List.Item style={{ border: 'none', padding: '8px 0' }}>
                <Space align="start" style={{ width: '100%' }}>
                  <Avatar icon={<UserOutlined />} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <Typography.Text strong>{message.author}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                        {message.time}
                      </Typography.Text>
                    </div>
                    <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
                      {renderWithMentions(message.text, handleMentionClick)}
                    </div>
                  </div>
                </Space>
              </List.Item>
            )}
          />
        </div>
        
        <div style={{ marginTop: '16px' }}>
          <MentionInput
            value={newMessage}
            onChange={setNewMessage}
            onSend={handleSendMessage}
            pis={PIS}
          />
        </div>
      </Card>
    </div>
  );
}
