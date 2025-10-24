'use client';

import React, { useState } from 'react';
import { Calendar, Badge, Card, Typography, Space, Statistic, Row, Col } from 'antd';
import { CalendarOutlined, DotChartOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text } = Typography;

// Mock data cho tracking theo ngày
const mockTrackingData: Record<string, number> = {
  '2024-10-01': 2,
  '2024-10-03': 1,
  '2024-10-05': 4,
  '2024-10-07': 3,
  '2024-10-10': 2,
  '2024-10-12': 5,
  '2024-10-15': 1,
  '2024-10-18': 3,
  '2024-10-20': 2,
  '2024-10-22': 4,
  '2024-10-24': 12, // Nhiều tracking để test +3
  '2024-10-26': 2,
  '2024-10-28': 1,
  '2024-10-30': 3,
  '2024-11-02': 2,
  '2024-11-05': 4,
  '2024-11-08': 1,
  '2024-11-10': 3,
  '2024-11-12': 2,
  '2024-11-15': 5,
  '2024-11-18': 1,
  '2024-11-20': 3,
  '2024-11-22': 2,
  '2024-11-25': 4,
  '2024-11-28': 2,
  '2024-11-30': 1,
  '2024-12-01': 15, // Nhiều tracking để test +6
  '2024-12-03': 8,
  '2024-12-05': 11, // Nhiều tracking để test +2
};

// Component hiển thị chấm tracking trong ô ngày
const TrackingDots: React.FC<{ count: number }> = ({ count }) => {
  if (count === 0) return null;
  
  // Hiển thị tối đa 9 chấm, nếu nhiều hơn thì hiển thị +X
  const maxDots = 9;
  const dotsToShow = Math.min(count, maxDots);
  
  const dots = Array.from({ length: dotsToShow }, (_, index) => (
    <div
      key={index}
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: '#ff4d4f', // Màu đỏ như trong ảnh
        display: 'inline-block',
        margin: '1px',
        border: '1px solid #fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
      }}
    />
  ));

  return (
    <div style={{ 
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '1px',
      maxWidth: '90%'
    }}>
      {dots}
      {count > maxDots && (
        <span style={{ 
          fontSize: '9px', 
          color: '#ff4d4f', 
          fontWeight: 'bold',
          marginLeft: '3px',
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '1px 3px',
          borderRadius: '3px',
          border: '1px solid #ff4d4f'
        }}>
          +{count - maxDots}
        </span>
      )}
    </div>
  );
};

export default function TrackingPage() {
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());

  // Tính toán thống kê
  const totalTracking = Object.values(mockTrackingData).reduce((sum, count) => sum + count, 0);
  const daysWithTracking = Object.keys(mockTrackingData).length;
  const averagePerDay = daysWithTracking > 0 ? (totalTracking / daysWithTracking).toFixed(1) : 0;

  // Xử lý cell render cho calendar
  const cellRender = (current: Dayjs, info: any) => {
    if (info.type !== 'date') return info.originNode;

    const dateStr = current.format('YYYY-MM-DD');
    const trackingCount = mockTrackingData[dateStr] || 0;
    
    // Debug: log để kiểm tra data
    if (trackingCount > 0) {
      console.log(`Date: ${dateStr}, Count: ${trackingCount}`);
    }

    return (
      <div style={{ position: 'relative', height: '100%' }}>
        {info.originNode}
        {/* Overlay chấm ở phía dưới */}
        <div style={{
          position: 'absolute',
          bottom: 4,
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none'
        }}>
          <TrackingDots count={trackingCount} />
        </div>
      </div>
    );
  };

  // Xử lý khi chọn ngày
  const onSelect = (date: Dayjs) => {
    setSelectedDate(date);
  };

  // Lấy thông tin tracking của ngày được chọn
  const selectedDateStr = selectedDate.format('YYYY-MM-DD');
  const selectedDateTracking = mockTrackingData[selectedDateStr] || 0;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Card>
          <Space align="center">
            <CalendarOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
            <Title level={2} style={{ margin: 0 }}>
              Tracking Calendar
            </Title>
          </Space>
          <Text type="secondary">
            Theo dõi số lượng tracking theo ngày với lịch biểu trực quan
          </Text>
        </Card>

        {/* Thống kê tổng quan */}
        <Row gutter={16}>
          <Col span={8}>
            <Card>
              <Statistic
                title="Tổng Tracking"
                value={totalTracking}
                prefix={<DotChartOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Ngày có Tracking"
                value={daysWithTracking}
                suffix="ngày"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Trung bình/ngày"
                value={averagePerDay}
                suffix="tracking"
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Calendar */}
        <Card title="Lịch Tracking">
          <Calendar
            cellRender={cellRender}
            onSelect={onSelect}
            value={selectedDate}
            style={{ width: '100%' }}
          />
        </Card>

        {/* Thông tin ngày được chọn */}
        <Card title={`Chi tiết ngày ${selectedDate.format('DD/MM/YYYY')}`}>
          <Space direction="vertical" size="middle">
            <div>
              <Text strong>Số lượng tracking: </Text>
              <Badge 
                count={selectedDateTracking} 
                style={{ backgroundColor: selectedDateTracking > 0 ? '#52c41a' : '#d9d9d9' }}
              />
            </div>
            {selectedDateTracking > 0 ? (
              <div>
                <Text type="secondary">
                  Ngày này có {selectedDateTracking} tracking được thực hiện
                </Text>
              </div>
            ) : (
              <div>
                <Text type="secondary">
                  Không có tracking nào được thực hiện trong ngày này
                </Text>
              </div>
            )}
          </Space>
        </Card>
      </Space>
    </div>
  );
}
