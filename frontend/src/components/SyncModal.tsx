import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch, apiUrl, getApiBaseUrl, getCurrentHostApiBaseUrl, normalizeApiBaseUrl, setApiBaseUrl } from '../utils/api';

interface SyncInfo {
  device_name: string;
  current_url: string;
  local_url: string;
  lan_urls: string[];
  stats: {
    events: number;
    todos: number;
    calendars: number;
    reminders: number;
  };
  server_time: string;
}

interface BackupFile {
  name: string;
  size: number;
  created_at: string;
}

interface DesktopStatus {
  is_windows: boolean;
  is_packaged: boolean;
  autostart_enabled: boolean;
  background_reminders: boolean;
  tray_enabled: boolean;
  log_path?: string;
}

interface SyncModalProps {
  isOpen: boolean;
  isInstallable: boolean;
  isStandalone: boolean;
  onClose: () => void;
  onInstall: () => Promise<boolean>;
  onRefreshData: () => void;
}

const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  isInstallable,
  isStandalone,
  onClose,
  onInstall,
  onRefreshData,
}) => {
  const [syncInfo, setSyncInfo] = useState<SyncInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [apiBaseInput, setApiBaseInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [desktopStatus, setDesktopStatus] = useState<DesktopStatus | null>(null);
  const [busyAction, setBusyAction] = useState('');

  const isSecure = typeof window !== 'undefined' ? window.isSecureContext : false;
  const primaryLanUrl = useMemo(() => syncInfo?.lan_urls?.[0] || '', [syncInfo]);

  useEffect(() => {
    if (!isOpen) return;
    setApiBaseInput(getApiBaseUrl());
    fetchSyncInfo();
    fetchBackups();
    fetchDesktopStatus();
  }, [isOpen]);

  const fetchSyncInfo = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await apiFetch('/api/sync/info');
      const data = await response.json();
      if (data.success) {
        setSyncInfo(data.data);
      } else {
        setMessage(data.error || '同步状态读取失败');
      }
    } catch (error) {
      console.error('Sync info error:', error);
      setMessage('无法连接数据主机');
    } finally {
      setLoading(false);
    }
  };

  const fetchBackups = async () => {
    try {
      const response = await apiFetch('/api/backup/list');
      const data = await response.json();
      if (data.success) {
        setBackups(data.data);
      }
    } catch (error) {
      console.error('Backup list error:', error);
    }
  };

  const fetchDesktopStatus = async () => {
    try {
      const response = await apiFetch('/api/desktop/status');
      const data = await response.json();
      if (data.success) {
        setDesktopStatus(data.data);
      }
    } catch (error) {
      console.error('Desktop status error:', error);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('已复制');
    } catch (error) {
      setMessage(text);
    }
  };

  const handleInstall = async () => {
    const accepted = await onInstall();
    setMessage(accepted ? '安装已开始' : '当前浏览器未打开安装确认');
  };

  const handleSaveApiBase = async () => {
    const nextBaseUrl = normalizeApiBaseUrl(apiBaseInput);
    if (!nextBaseUrl) {
      setMessage('请输入数据主机地址');
      return;
    }

    setTesting(true);
    setMessage('');
    try {
      const response = await fetch(`${nextBaseUrl}/api/health`);
      const data = await response.json();
      if (response.ok && data.status === 'healthy') {
        setApiBaseUrl(nextBaseUrl);
        setApiBaseInput(nextBaseUrl);
        setMessage('数据主机已切换');
        onRefreshData();
        fetchSyncInfo();
      } else {
        setMessage('这个地址不是可用的数据主机');
      }
    } catch (error) {
      console.error('API host test failed:', error);
      setMessage('无法连接这个数据主机');
    } finally {
      setTesting(false);
    }
  };

  const handleUseCurrentHost = () => {
    const current = getCurrentHostApiBaseUrl();
    setApiBaseUrl(current);
    setApiBaseInput(current);
    setMessage('已使用当前访问地址');
    onRefreshData();
    fetchSyncInfo();
  };

  const handleCreateBackup = async () => {
    setBusyAction('backup');
    setMessage('');
    try {
      const response = await apiFetch('/api/backup/create', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setMessage('本机备份已创建');
        fetchBackups();
      } else {
        setMessage(data.error || '备份失败');
      }
    } catch (error) {
      console.error('Create backup error:', error);
      setMessage('备份失败');
    } finally {
      setBusyAction('');
    }
  };

  const handleExportJson = () => {
    window.open(apiUrl('/api/backup/export'), '_blank');
  };

  const handleToggleAutostart = async () => {
    if (!desktopStatus) return;
    setBusyAction('autostart');
    setMessage('');
    try {
      const response = await apiFetch('/api/desktop/autostart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !desktopStatus.autostart_enabled }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage(data.data.autostart_enabled ? '已开启开机自启' : '已关闭开机自启');
        fetchDesktopStatus();
      } else {
        setMessage(data.error || '开机自启设置失败');
      }
    } catch (error) {
      console.error('Autostart error:', error);
      setMessage('开机自启设置失败');
    } finally {
      setBusyAction('');
    }
  };

  const formatSize = (size: number) => {
    if (size >= 1024 * 1024) {
      return `${(size / 1024 / 1024).toFixed(1)} MB`;
    }
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content sync-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>设备同步</h2>
          <button className="btn-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
            </svg>
          </button>
        </div>

        <div className="sync-body">
          <div className="sync-status-grid">
            <div className="sync-status-card">
              <span className="sync-label">数据主机</span>
              <strong>{syncInfo?.device_name || (loading ? '读取中' : '未连接')}</strong>
            </div>
            <div className="sync-status-card">
              <span className="sync-label">日程</span>
              <strong>{syncInfo?.stats.events ?? '-'}</strong>
            </div>
            <div className="sync-status-card">
              <span className="sync-label">任务</span>
              <strong>{syncInfo?.stats.todos ?? '-'}</strong>
            </div>
            <div className="sync-status-card">
              <span className="sync-label">状态</span>
              <strong>{isStandalone ? '已安装' : isSecure ? '可安装' : '普通访问'}</strong>
            </div>
          </div>

          <section className="sync-section">
            <div className="sync-section-header">
              <h3>手机访问地址</h3>
              <button className="btn btn-secondary btn-compact" onClick={fetchSyncInfo} disabled={loading}>
                刷新
              </button>
            </div>

            {primaryLanUrl ? (
              <div className="sync-url-list">
                {syncInfo?.lan_urls.map(url => (
                  <button key={url} className="sync-url" onClick={() => copyText(url)}>
                    <span>{url}</span>
                    <small>复制</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="sync-empty">
                {loading ? '正在查找局域网地址' : '未找到局域网地址'}
              </div>
            )}
          </section>

          <section className="sync-section">
            <div className="sync-section-header">
              <h3>当前设备安装</h3>
              <span className={`sync-pill ${isStandalone ? 'ok' : isInstallable ? 'ready' : ''}`}>
                {isStandalone ? 'Standalone' : isInstallable ? 'Installable' : isSecure ? 'Browser' : 'HTTP'}
              </span>
            </div>
            <div className="install-actions">
              <button className="btn btn-primary" onClick={handleInstall} disabled={isStandalone}>
                {isStandalone ? '已安装' : '安装到当前设备'}
              </button>
              <button className="btn btn-secondary" onClick={handleUseCurrentHost}>
                使用当前地址
              </button>
            </div>
          </section>

          <section className="sync-section">
            <div className="sync-section-header">
              <h3>数据主机地址</h3>
            </div>
            <div className="sync-host-row">
              <input
                value={apiBaseInput}
                onChange={event => setApiBaseInput(event.target.value)}
                placeholder="http://电脑IP:8000"
              />
              <button className="btn btn-primary" onClick={handleSaveApiBase} disabled={testing}>
                {testing ? '检测中' : '连接'}
              </button>
            </div>
          </section>

          <section className="sync-section">
            <div className="sync-section-header">
              <h3>桌面常驻</h3>
              <span className={`sync-pill ${desktopStatus?.background_reminders || desktopStatus?.tray_enabled ? 'ok' : ''}`}>
                {desktopStatus?.tray_enabled ? '托盘常驻' : desktopStatus?.background_reminders ? '提醒运行中' : '浏览器模式'}
              </span>
            </div>
            <div className="install-actions">
              <button
                className="btn btn-primary"
                onClick={handleToggleAutostart}
                disabled={!desktopStatus?.is_windows || busyAction === 'autostart'}
              >
                {desktopStatus?.autostart_enabled ? '关闭开机自启' : '开启开机自启'}
              </button>
              <button className="btn btn-secondary" onClick={fetchDesktopStatus}>
                刷新状态
              </button>
            </div>
            {desktopStatus?.log_path && (
              <p className="sync-small-text">日志：{desktopStatus.log_path}</p>
            )}
          </section>

          <section className="sync-section">
            <div className="sync-section-header">
              <h3>数据备份</h3>
              <span className="sync-pill">{backups.length} 个备份</span>
            </div>
            <div className="install-actions">
              <button className="btn btn-primary" onClick={handleCreateBackup} disabled={busyAction === 'backup'}>
                {busyAction === 'backup' ? '备份中' : '创建本机备份'}
              </button>
              <button className="btn btn-secondary" onClick={handleExportJson}>
                导出 JSON
              </button>
            </div>
            {backups[0] ? (
              <div className="backup-latest">
                <span>{backups[0].name}</span>
                <small>{formatSize(backups[0].size)} · {backups[0].created_at}</small>
              </div>
            ) : (
              <div className="sync-empty">还没有本机备份</div>
            )}
          </section>

          {message && <div className="sync-message">{message}</div>}
        </div>
      </div>
    </div>
  );
};

export default SyncModal;
