"use client";
import React from "react";
import { Card, Typography, Button, Space, Tag } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useParams, useRouter } from "next/navigation";

// Mock data
const PIS = [
  { id: 'PI-3023', title: 'Improve file sharing flow', status: 'In Progress' },
  { id: 'PI-1199', title: 'Refactor chat composer', status: 'Todo' },
  { id: 'PI-4501', title: 'Implement stair-climb RL', status: 'Done' }
];

type PI = {
  id: string;
  title: string;
  status: string;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'In Progress':
      return 'processing';
    case 'Todo':
      return 'default';
    case 'Done':
      return 'success';
    default:
      return 'default';
  }
};

export default function PiDetailPage() {
  const params = useParams();
  const router = useRouter();
  const piId = params.piId as string;

  const pi = PIS.find(p => p.id === piId);

  if (!pi) {
    return (
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <Card>
          <Typography.Title level={3}>PI không tồn tại</Typography.Title>
          <Typography.Text>Không tìm thấy PI với ID: {piId}</Typography.Text>
          <br />
          <Button 
            type="primary" 
            icon={<ArrowLeftOutlined />} 
            onClick={() => router.push('/chat')}
            style={{ marginTop: '16px' }}
          >
            Quay lại Chat
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />} 
              onClick={() => router.push('/chat')}
              style={{ marginBottom: '16px' }}
            >
              Quay lại Chat
            </Button>
          </div>
          
          <div>
            <Typography.Title level={2}>{pi.title}</Typography.Title>
            <Space>
              <Typography.Text strong>ID:</Typography.Text>
              <Typography.Text code>{pi.id}</Typography.Text>
            </Space>
          </div>

          <div>
            <Space>
              <Typography.Text strong>Trạng thái:</Typography.Text>
              <Tag color={getStatusColor(pi.status)}>{pi.status}</Tag>
            </Space>
          </div>

          <div>
            <Typography.Title level={4}>Chi tiết</Typography.Title>
            <Typography.Paragraph>
              Đây là trang chi tiết của PI {pi.id}. Bạn có thể thêm các thông tin chi tiết khác về PI này như:
            </Typography.Paragraph>
            <ul>
              <li>Mô tả chi tiết</li>
              <li>Người phụ trách</li>
              <li>Ngày bắt đầu và kết thúc</li>
              <li>Tiến độ hoàn thành</li>
              <li>Các task con</li>
              <li>Comments và ghi chú</li>
            </ul>
          </div>
        </Space>
      </Card>
    </div>
  );
}
