export function getDisplayName(displayname: any): string | null {
  if (!displayname) return null;
  return displayname.en || displayname.ar || displayname.ku || null;
}

export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getPreviewUrl(file: File): string | null {
  if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
    return URL.createObjectURL(file);
  }
  return null;
}

export function getFileIcon(file: File): string {
  if (file.type.startsWith("image/")) return "🖼️";
  if (file.type.startsWith("video/")) return "🎥";
  if (file.type.startsWith("audio/")) {
    if (file.name.includes("voice_message_")) return "🎤";
    return "🎵";
  }
  if (file.type.includes("pdf")) return "📄";
  if (file.type.includes("document") || file.type.includes("word")) return "📝";
  if (file.type.includes("spreadsheet") || file.type.includes("excel"))
    return "📊";
  return "📎";
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function formatRecordingDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function scrollToBottom(chatContainer: HTMLElement | null): void {
  setTimeout(() => {
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, 100);
}

export interface MessageData {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Date;
  isOwn: boolean;
  hasAttachments?: boolean;
  attachments?: any[] | null;
  isUploading?: boolean;
  uploadFailed?: boolean;
}

export interface UserData {
  id: string;
  shortname: string;
  name: string;
  email?: string;
  avatar?: string | null;
  online: boolean;
  lastSeen: Date;
  roles: string[];
  isActive: boolean;
}

export interface GroupData {
  id: string;
  shortname: string;
  name: string;
  description?: string;
  avatar?: string | null;
  participants: string[];
  adminIds: string[];
  createdBy: string;
  createdAt: Date;
  isActive: boolean;
  isGroup: true;
}

export interface GroupMessageData extends Omit<MessageData, "receiverId"> {
  groupId: string;
  receiverId?: never;
}

export function transformUserRecord(record: any): UserData {
  const attrs = record.attributes;
  return {
    id: record.shortname,
    shortname: record.shortname,
    name: getDisplayName(attrs.displayname) || attrs.email || record.shortname,
    email: attrs.email,
    avatar: attrs.social_avatar_url || null,
    online: false,
    lastSeen: new Date(attrs.updated_at || attrs.created_at),
    roles: attrs.roles || [],
    isActive: attrs.is_active,
  };
}

export function transformMessageRecord(
  record: any,
  currentUserShortname: string
): MessageData {
  const attachments = record?.attachments?.media || null;
  const payload = record.attributes.payload;
  const body = payload.body;

  return {
    id: record.shortname,
    senderId: body.sender,
    receiverId: body.receiver,
    content: body.content,
    attachments: attachments,
    timestamp: new Date(record.attributes.created_at || Date.now()),
    isOwn: body.sender === currentUserShortname,
  };
}

export function transformGroupRecord(record: any): GroupData {
  const attrs = record.attributes;
  const payload = attrs.payload?.body || {};

  return {
    id: record.shortname,
    shortname: record.shortname,
    name: getDisplayName(attrs.displayname) || record.shortname,
    description: attrs.description || "",
    avatar: attrs.social_avatar_url || null,
    participants: payload.participants || [],
    adminIds: payload.adminIds || [payload.createdBy],
    createdBy: payload.createdBy || "",
    createdAt: new Date(attrs.created_at || Date.now()),
    isActive: attrs.is_active !== false,
    isGroup: true,
  };
}

export function transformGroupMessageRecord(
  record: any,
  currentUserShortname: string
): GroupMessageData {
  const attachments = record?.attachments?.media || null;
  const payload = record.attributes.payload;
  const body = payload.body;

  return {
    id: record.shortname,
    senderId: body.sender,
    groupId: body.groupId,
    content: body.content,
    attachments: attachments,
    timestamp: new Date(record.attributes.created_at || Date.now()),
    isOwn: body.sender === currentUserShortname,
  };
}

export function getCacheKey(
  currentUserShortname: string,
  selectedUserShortname: string
): string {
  return `chat_${currentUserShortname}_${selectedUserShortname}`;
}

export function cacheMessages(cacheKey: string, messages: MessageData[]): void {
  try {
    localStorage.setItem(cacheKey, JSON.stringify(messages));
  } catch (error) {
    console.error("Cache update error:", error);
  }
}

export function getCachedMessages(cacheKey: string): MessageData[] {
  try {
    const cachedMessages = localStorage.getItem(cacheKey);
    if (cachedMessages) {
      return JSON.parse(cachedMessages);
    }
  } catch (error) {
    console.error("Cache retrieval error:", error);
  }
  return [];
}

export function isRelevantMessage(
  data: any,
  selectedUserShortname: string,
  currentUserShortname: string
): boolean {
  return (
    (data.senderId === selectedUserShortname &&
      data.receiverId === currentUserShortname) ||
    (data.senderId === currentUserShortname &&
      data.receiverId === selectedUserShortname)
  );
}

export function sortMessagesByTimestamp(
  messages: MessageData[]
): MessageData[] {
  return messages.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

export function isRelevantGroupMessage(
  data: any,
  groupId: string,
  currentUserShortname: string
): boolean {
  return data.groupId === groupId && data.senderId !== currentUserShortname;
}

export function getGroupCacheKey(
  currentUserShortname: string,
  groupId: string
): string {
  return `group_chat_${currentUserShortname}_${groupId}`;
}

export function isUserGroupAdmin(
  group: GroupData,
  userShortname: string
): boolean {
  return group.adminIds.includes(userShortname);
}

export function isUserGroupParticipant(
  group: GroupData,
  userShortname: string
): boolean {
  return group.participants.includes(userShortname);
}

export function canUserAccessGroup(
  group: GroupData,
  userShortname: string
): boolean {
  return (
    isUserGroupParticipant(group, userShortname) ||
    isUserGroupAdmin(group, userShortname)
  );
}

export function getGroupDisplayName(
  group: GroupData,
  fallback: string = "Unknown Group"
): string {
  return group.name || fallback;
}

export function formatGroupParticipantCount(count: number): string {
  if (count === 1) return "1 participant";
  return `${count} participants`;
}
