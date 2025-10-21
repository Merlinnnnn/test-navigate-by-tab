"use client";
import React from "react";
import { Card, Typography, Space, Divider } from "antd";
import Link from "next/link";
import ThreeDViewer from "./ThreeDViewer";

export default function CadViewPage() {
  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <Typography.Title level={2}>3D CAD Viewer</Typography.Title>
        <Typography.Text type="secondary">
          Kéo thả và xem các file thiết kế CAD 3D với hỗ trợ nhiều định dạng
        </Typography.Text>
      </div>

      <Card 
        title="3D File Viewer" 
        style={{ marginBottom: "24px" }}
        bodyStyle={{ padding: 0 }}
      >
        <div style={{ padding: "24px" }}>
          <Space direction="vertical" style={{ width: "100%" }}>
            <Typography.Paragraph>
              <strong>Hỗ trợ định dạng:</strong> .glb, .gltf, .stl, .obj, .step/.stp
            </Typography.Paragraph>
            <Typography.Paragraph>
              <strong>Tính năng:</strong> Kéo thả file, điều khiển camera, auto-framing, grid, lighting, STEP conversion
            </Typography.Paragraph>
          </Space>
        </div>
        
        <Divider style={{ margin: 0 }} />
        
        <div style={{ height: "600px", padding: "24px" }}>
          <ThreeDViewer />
        </div>
      </Card>

      <div style={{ marginTop: "24px", textAlign: "center" }}>
        <Link href="/">← Về trang chủ</Link>
      </div>
    </div>
  );
}
