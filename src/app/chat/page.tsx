"use client";
import React, { useState } from "react";
import { List, Avatar, Typography, Tag, Space, Button, Input, Card, Modal, Divider, Segmented, Tooltip, Spin, Empty, Image } from "antd";
import { UserOutlined, SendOutlined, FileImageOutlined, FilePdfOutlined, EyeOutlined, DownloadOutlined, LinkOutlined, SearchOutlined } from "@ant-design/icons";
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
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);

  type FileItem = { id: string; name: string; type: 'image' | 'pdf'; url: string };
  const files: FileItem[] = [
    { id: 'f1', name: 'Design Mockup.png', type: 'image', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200' },
    { id: 'f2', name: 'Report Q3.pdf', type: 'pdf', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
    { id: 'f3', name: 'Bug Screenshot.jpg', type: 'image', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200' },
  ];
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(files[0] ?? null);
  const [filterType, setFilterType] = useState<'all' | 'image' | 'pdf'>('all');
  const [searchText, setSearchText] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  React.useEffect(() => {
    if (selectedFile?.type === 'image') {
      setPreviewLoading(true);
    } else {
      setPreviewLoading(false);
    }
  }, [selectedFile]);

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
      <Card 
        title="Chat với PI Mentions" 
        style={{ marginBottom: '20px' }}
        extra={
          <Button onClick={() => setIsFileModalOpen(true)}>
            Mở danh sách file
          </Button>
        }
      >
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

      <Modal
        title="Danh sách file"
        open={isFileModalOpen}
        onCancel={() => setIsFileModalOpen(false)}
        footer={null}
        width={1000}
        styles={{ body: { padding: 16 } }}
      >
        <div style={{ display: 'flex', gap: 16, minHeight: 520 }}>
          <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 1, background: '#fff', paddingBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
              <Input
                allowClear
                placeholder="Tìm theo tên file"
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <Segmented
                options={[{ label: 'Tất cả', value: 'all' }, { label: 'Ảnh', value: 'image' }, { label: 'PDF', value: 'pdf' }]}
                value={filterType}
                onChange={(val) => setFilterType(val as 'all' | 'image' | 'pdf')}
              />
              </div>
              <div style={{ marginTop: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {files.filter(f => (filterType === 'all' || f.type === filterType) && f.name.toLowerCase().includes(searchText.toLowerCase())).length} file
                </Typography.Text>
              </div>
            </div>

            <div style={{ border: '1px solid #edf2f7', borderRadius: 16, background: '#fff', boxShadow: '0 8px 20px rgba(17,24,39,0.04), 0 2px 6px rgba(17,24,39,0.06)' }}>
              <List
                dataSource={files.filter(f => (filterType === 'all' || f.type === filterType) && f.name.toLowerCase().includes(searchText.toLowerCase()))}
                locale={{ emptyText: <Empty description="Không có file" /> as any }}
                style={{ maxHeight: 420, overflowY: 'auto' }}
                renderItem={(f) => {
                  const isSelected = selectedFile?.id === f.id;
                  return (
                    <List.Item
                      onClick={() => setSelectedFile(f)}
                      style={{
                        cursor: 'pointer',
                        padding: '12px 14px',
                        margin: 8,
                        borderRadius: 12,
                        transition: 'all .15s ease',
                        background: isSelected ? 'linear-gradient(180deg,#f5faff,#ffffff)' : '#fff',
                        border: isSelected ? '1px solid #cfe1ff' : '1px solid #f0f0f0',
                        boxShadow: isSelected ? '0 6px 18px rgba(22,119,255,0.10)' : 'none'
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          f.type === 'image' ? (
                            <Image
                              src={f.url}
                              alt={f.name}
                              width={48}
                              height={36}
                              style={{ objectFit: 'cover', borderRadius: 6 }}
                              preview={false}
                              fallback="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='36'/>"
                            />
                          ) : (
                            <Avatar shape="square" style={{ backgroundColor: '#fff1f0', borderRadius: 8 }} icon={<FilePdfOutlined style={{ color: '#ff4d4f' }} />} />
                          )
                        }
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <Typography.Text strong ellipsis style={{ maxWidth: 220 }}>{f.name}</Typography.Text>
                            {isSelected && <Tag color="#e6f0ff" style={{ marginLeft: 8, marginRight: 0, color: '#1d4ed8', borderColor: '#cfe1ff' }}>Đang xem</Tag>}
                          </div>
                        }
                        description={<Typography.Text type="secondary" style={{ fontSize: 12 }}>{f.type.toUpperCase()}</Typography.Text>}
                      />
                    </List.Item>
                  );
                }}
              />
            </div>
          </div>
          <Divider type="vertical" style={{ height: 'auto' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(180deg,#ffffff,#fafafa)', border: '1px solid #edf2f7', borderRadius: 14, padding: '10px 12px', boxShadow: 'inset 0 -1px 0 rgba(17,24,39,0.03)' }}>
              <div>
                <Typography.Text strong style={{ marginRight: 8 }}>{selectedFile?.name ?? '—'}</Typography.Text>
                {selectedFile && (
                  <Tag color={selectedFile.type === 'image' ? '#e6f0ff' : '#ffeaea'} style={{ marginLeft: 0, color: selectedFile.type === 'image' ? '#1d4ed8' : '#b42318', borderColor: selectedFile.type === 'image' ? '#cfe1ff' : '#ffd1d1' }}>
                    {selectedFile.type.toUpperCase()}
                  </Tag>
                )}
              </div>
              <Space>
                {selectedFile && (
                  <>
                    <Tooltip title="Mở tab mới">
                      <Button type="default" ghost icon={<LinkOutlined />} onClick={() => window.open(selectedFile.url, '_blank')} style={{ borderRadius: 10 }} />
                    </Tooltip>
                    <Tooltip title="Tải xuống">
                      <Button type="default" ghost icon={<DownloadOutlined />} onClick={() => {
                        const a = document.createElement('a');
                        a.href = selectedFile.url;
                        a.download = selectedFile.name;
                        a.target = '_blank';
                        a.rel = 'noopener noreferrer';
                        a.click();
                      }} style={{ borderRadius: 10 }} />
                    </Tooltip>
                  </>
                )}
              </Space>
            </div>
            <Card bodyStyle={{ padding: 0 }} style={{ flex: 1, overflow: 'hidden', borderRadius: 16, boxShadow: '0 10px 24px rgba(17,24,39,0.05), 0 2px 8px rgba(17,24,39,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#fbfbfc,#f7f7fb)', height: '70vh', maxHeight: 560 }}>
                {!selectedFile && (
                  <Empty description="Chọn một file để xem trước" />
                )}
                {selectedFile?.type === 'image' && (
                  <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                    <Spin spinning={previewLoading} style={{ position: 'absolute' }} />
                    <Image
                      src={selectedFile.url}
                      alt={selectedFile.name}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      preview={{ mask: 'Xem lớn' }}
                      onLoad={() => setPreviewLoading(false)}
                      onError={() => setPreviewLoading(false)}
                    />
                  </div>
                )}
                {selectedFile?.type === 'pdf' && (
                  <iframe
                    title={selectedFile.name}
                    src={selectedFile.url}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                )}
              </div>
            </Card>
          </div>
        </div>
      </Modal>
    </div>
  );
}
