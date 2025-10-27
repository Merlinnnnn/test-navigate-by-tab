"use client";
import React from "react";
import { Button, Card, Typography, Space } from "antd";
import { MessageOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <Card style={{ maxWidth: "600px", width: "100%" }}>
        <Space direction="vertical" size="large" style={{ width: "100%", textAlign: "center" }}>
          <Typography.Title level={1}>PI Chat Demo</Typography.Title>
          
          <Typography.Paragraph style={{ fontSize: "16px", color: "#666" }}>
            Demo ứng dụng chat với tính năng mention PI. Sử dụng @PI để mention các PI items và điều hướng đến trang chi tiết.
          </Typography.Paragraph>

          <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
            <Button 
              type="primary" 
              size="large" 
              icon={<MessageOutlined />} 
              onClick={() => router.push('/chat')}
            >
              Mở Chat
            </Button>
            
            <Button 
              size="large" 
              icon={<ArrowRightOutlined />}
              onClick={() => router.push('/pi/PI-3023')}
            >
              Xem PI Demo
            </Button>
          </div>

          <div style={{ marginTop: "32px", textAlign: "left" }}>
            <Typography.Title level={4}>Tính năng:</Typography.Title>
            <ul>
              <li>Chat với danh sách tin nhắn từ mock data</li>
              <li>Parse và hiển thị mentions dạng @PI:PI-ID(username)</li>
              <li>Click vào mention để điều hướng đến trang chi tiết PI</li>
              <li>Input với tính năng @ mention (PI, file, people)</li>
              <li>Trang chi tiết PI với thông tin mock</li>
            </ul>
          </div>
        </Space>
      </Card>
    </div>
  );
}
