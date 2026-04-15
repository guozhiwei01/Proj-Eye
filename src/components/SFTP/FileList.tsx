import { FileEntry } from '../../lib/backend-sftp';
import {
  Folder,
  File,
  FileText,
  FileCode,
  FileImage,
  FileArchive
} from 'lucide-react';

interface FileListProps {
  files: FileEntry[];
  onFileClick: (file: FileEntry) => void;
  onFileDoubleClick: (file: FileEntry) => void;
  selectedPath?: string;
}

function getFileIcon(file: FileEntry) {
  if (file.is_dir) {
    return <Folder size={16} style={{ color: 'var(--accent)' }} />;
  }

  const ext = file.name.split('.').pop()?.toLowerCase();

  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) {
    return <FileImage size={16} style={{ color: 'var(--text1)' }} />;
  }

  if (['js', 'ts', 'jsx', 'tsx', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h'].includes(ext || '')) {
    return <FileCode size={16} style={{ color: 'var(--text1)' }} />;
  }

  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext || '')) {
    return <FileArchive size={16} style={{ color: 'var(--text1)' }} />;
  }

  if (['txt', 'md', 'log', 'json', 'xml', 'yaml', 'yml'].includes(ext || '')) {
    return <FileText size={16} style={{ color: 'var(--text1)' }} />;
  }

  return <File size={16} style={{ color: 'var(--text1)' }} />;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

export function FileList({ files, onFileClick, onFileDoubleClick, selectedPath }: FileListProps) {
  return (
    <div
      className="flex-1 overflow-auto"
      style={{
        backgroundColor: 'var(--bg1)',
        fontSize: '13px'
      }}
    >
      <table className="w-full">
        <thead
          style={{
            backgroundColor: 'var(--bg2)',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            zIndex: 1
          }}
        >
          <tr>
            <th className="text-left p-2" style={{ color: 'var(--text1)', fontWeight: 500 }}>
              Name
            </th>
            <th className="text-right p-2" style={{ color: 'var(--text1)', fontWeight: 500 }}>
              Size
            </th>
            <th className="text-left p-2" style={{ color: 'var(--text1)', fontWeight: 500 }}>
              Modified
            </th>
            <th className="text-left p-2" style={{ color: 'var(--text1)', fontWeight: 500 }}>
              Permissions
            </th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr
              key={file.path}
              onClick={() => onFileClick(file)}
              onDoubleClick={() => onFileDoubleClick(file)}
              className="cursor-pointer transition-colors"
              style={{
                backgroundColor: selectedPath === file.path ? 'var(--bg2)' : 'transparent',
                borderBottom: '1px solid var(--border)',
              }}
              onMouseEnter={(e) => {
                if (selectedPath !== file.path) {
                  e.currentTarget.style.backgroundColor = 'var(--bg2)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedPath !== file.path) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <td className="p-2">
                <div className="flex items-center gap-2">
                  {getFileIcon(file)}
                  <span style={{ color: 'var(--text0)' }}>{file.name}</span>
                </div>
              </td>
              <td className="p-2 text-right" style={{ color: 'var(--text1)' }}>
                {file.is_dir ? '-' : formatFileSize(file.size)}
              </td>
              <td className="p-2" style={{ color: 'var(--text1)' }}>
                {formatDate(file.modified)}
              </td>
              <td className="p-2" style={{ color: 'var(--text2)', fontFamily: 'monospace' }}>
                {file.permissions}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {files.length === 0 && (
        <div
          className="flex items-center justify-center h-32"
          style={{ color: 'var(--text2)' }}
        >
          Empty directory
        </div>
      )}
    </div>
  );
}
