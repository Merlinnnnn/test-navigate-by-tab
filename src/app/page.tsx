"use client";
import React from "react";
import { Button, Drawer, Input, Upload, Space, Avatar, List, Typography, Image, Tag } from "antd";
import { SendOutlined, MessageOutlined, PaperClipOutlined, UserOutlined, CloseOutlined } from "@ant-design/icons";

type Message = {
  id: string;
  author: "me" | "bot";
  content: string;
  time: string;
  attachments?: Array<{ name: string; type: string; url?: string }>;
};

export default function Home() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([{
    id: "m1",
    author: "bot",
    content: "Xin chào! Hãy nhập tin nhắn hoặc gửi file để bắt đầu.",
    time: new Date().toLocaleTimeString(),
  }]);
  const [input, setInput] = React.useState("");
  const [attachments, setAttachments] = React.useState<Array<{ file: File; previewUrl?: string }>>([]);

  const sendText = () => {
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;

    const atts = attachments.map(a => ({ name: a.file.name, type: a.file.type, url: a.previewUrl }));
    setMessages(prev => ([...prev, { id: String(Date.now()), author: "me", content: trimmed, attachments: atts, time: new Date().toLocaleTimeString() }]));
    setInput("");
    setAttachments([]);
  };

  const onPickFile = async (file: File) => {
    const isImage = file.type.startsWith("image/");
    const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
    setAttachments(prev => [...prev, { file, previewUrl }]);
    return false; // prevent auto upload
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Button type="primary" size="large" icon={<MessageOutlined />} onClick={() => setOpen(true)}>
        Mở chat
      </Button>

      <Drawer
        title={<Space><Avatar icon={<UserOutlined />} /> <span>Chat demo</span></Space>}
        placement="right"
        width={420}
        open={open}
        onClose={() => setOpen(false)}
        styles={{ body: { display: "flex", flexDirection: "column", padding: 0 } }}
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{ padding: 16, flex: 1, overflow: "auto", background: "#fafafa" }}>
            <List
              dataSource={messages}
              renderItem={(m) => (
                <List.Item style={{ border: "none", padding: "8px 0" }}>
                  <Space align="start" style={{ width: "100%", justifyContent: m.author === "me" ? "flex-end" : "flex-start" }}>
                    {m.author === "bot" && <Avatar icon={<UserOutlined />} />}
                    <div style={{ flex: 1, maxWidth: "100%", background: m.author === "me" ? "#1677ff" : "#fff", color: m.author === "me" ? "#fff" : "inherit", border: "1px solid #f0f0f0", padding: "12px 14px", borderRadius: 10, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4, fontWeight: 500 }}>
                        {m.author === "me" ? "Bạn" : "Bot"}
                      </div>
                      <Typography.Text style={{ color: m.author === "me" ? "#fff" : undefined }}>{m.content}</Typography.Text>
                      {m.attachments && m.attachments.length > 0 && (
                        <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {m.attachments.map((a, i) => (
                            <div key={i} style={{ background: m.author === "me" ? "rgba(255,255,255,0.15)" : "#fafafa", borderRadius: 6, padding: 6, border: "1px solid #f0f0f0" }}>
                              {a.url && a.type.startsWith("image/") ? (
                                <Image src={a.url} width={120} height={120} style={{ objectFit: "cover" }} alt={a.name} />
                              ) : (
                                <Space>
                                  <PaperClipOutlined />
                                  <Typography.Text style={{ color: m.author === "me" ? "#fff" : undefined }}>{a.name}</Typography.Text>
                                </Space>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 4, opacity: 0.6, fontSize: 12 }}>{m.time}</div>
                    </div>
                    {m.author === "me" && <Avatar style={{ backgroundColor: "#1677ff" }}>Me</Avatar>}
                  </Space>
                </List.Item>
              )}
            />
          </div>

          <div style={{ padding: 12, borderTop: "1px solid #f0f0f0", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ border: "1px solid #d9d9d9", borderRadius: 10, background: "#fff", overflow: "hidden" }}>
              {attachments.length > 0 && (
                <div style={{ padding: 10, borderBottom: "1px solid #f0f0f0", background: "#fff" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {attachments.map((a, idx) => (
                      <div key={idx} style={{ position: "relative", border: "1px solid #f0f0f0", borderRadius: 8, padding: 6, background: "#fff" }}>
                        {a.previewUrl ? (
                          <Image src={a.previewUrl} width={96} height={96} style={{ objectFit: "cover" }} alt={a.file.name} />
                        ) : (
                          <Tag icon={<PaperClipOutlined />} color="default" style={{ padding: 6, margin: 0 }}>{a.file.name}</Tag>
                        )}
                        <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => removeAttachment(idx)} style={{ position: "absolute", top: -10, right: -10 }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Input.TextArea
                placeholder="Nhập tin nhắn..."
                autoSize={{ minRows: 4, maxRows: 8 }}
                value={input}
                bordered={false}
                onChange={(e) => setInput(e.target.value)}
                onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); sendText(); } }}
                style={{ padding: 12, lineHeight: 1.5, resize: "none" as any }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, borderTop: "1px solid #f0f0f0", background: "#fff" }}>
                <Upload beforeUpload={onPickFile} multiple showUploadList={false}>
                  <Button type="text" icon={<PaperClipOutlined />} aria-label="Đính kèm">Đính kèm</Button>
                </Upload>
                <div style={{ flex: 1 }} />
                <Button type="primary" icon={<SendOutlined />} onClick={sendText}>Gửi</Button>
              </div>
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
