import { useState } from 'react';
import { FileEntry } from '../../lib/backend-sftp';
import { FileList } from './FileList';
import { ChevronRight, Home, RefreshCw } from 'lucide-react';

interface FilePaneProps {
  type: 'local' | 'remote';
  files: FileEntry[];
  currentPath: string;
  loading: boolean;
  error: string | null;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  onFileSelect?: (file: FileEntry) => void;
}

export function FilePane({
  type,
  files,
  currentPath,
  loading,
  error,
  onNavigate,
  onRefresh,
  onFileSelect,
}: FilePaneProps) {
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);

  const pathSegments = currentPath.split('/').filter(Boolean);

  const handleFileClick = (file: FileEntry) => {
    setSelectedFile(file);
    onFileSelect?.(file);
  };

  const handleFileDoubleClick = (file: FileEntry) => {
    if (file.is_dir) {
      onNavigate(file.path);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      onNavigate('/');
    } else {
      const path = '/' + pathSegments.slice(0, index + 1).join('/');
      onNavigate(path);
    }
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{
        borderRight: type === 'local' ? '1px solid var(--border)' : 'none',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-2"
        style={{
          backgroundColor: 'var(--bg2)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text0)' }}>
          {type === 'local' ? 'Local' : 'Remote'}
        </span>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1 rounded transition-colors"
          style={{
            color: 'var(--text1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Breadcrumb */}
      <div
        className="flex items-center gap-1 p-2 overflow-x-auto"
        style={{
          backgroundColor: 'var(--bg1)',
          borderBottom: '1px solid var(--border)',
          fontSize: '12px',
        }}
      >
        <button
          onClick={() => handleBreadcrumbClick(-1)}
          className="flex items-center gap-1 px-2 py-1 rounded transition-colors"
          style={{ color: 'var(--text1)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Home size={14} />
        </button>

        {pathSegments.map((segment, index) => (
          <div key={index} className="flex items-center gap-1">
            <ChevronRight size={14} style={{ color: 'var(--text2)' }} />
            <button
              onClick={() => handleBreadcrumbClick(index)}
              className="px-2 py-1 rounded transition-colors"
              style={{ color: 'var(--text0)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {segment}
            </button>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div
          className="p-2 text-sm"
          style={{
            backgroundColor: 'var(--error-bg, #fee)',
            color: 'var(--error, #c00)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {error}
        </div>
      )}

      {/* File List */}
      <FileList
        files={files}
        onFileClick={handleFileClick}
        onFileDoubleClick={handleFileDoubleClick}
        selectedPath={selectedFile?.path}
      />
    </div>
  );
}
