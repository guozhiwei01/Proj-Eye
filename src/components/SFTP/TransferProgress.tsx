import { TransferProgress as TransferProgressType } from '../../lib/backend-sftp';
import { Upload, Download, X, CheckCircle, XCircle } from 'lucide-react';

interface TransferProgressProps {
  transfers: TransferProgressType[];
  onCancel: (transferId: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatSpeed(bytesPerSecond: number): string {
  return formatFileSize(bytesPerSecond) + '/s';
}

export function TransferProgress({ transfers, onCancel }: TransferProgressProps) {
  if (transfers.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        backgroundColor: 'var(--bg1)',
        maxHeight: '200px',
        overflowY: 'auto',
      }}
    >
      <div
        className="p-2 text-xs font-medium"
        style={{
          backgroundColor: 'var(--bg2)',
          color: 'var(--text1)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        File Transfers ({transfers.length})
      </div>

      <div className="p-2 space-y-2">
        {transfers.map((transfer) => {
          const percentage =
            transfer.total_bytes > 0
              ? Math.round((transfer.transferred_bytes / transfer.total_bytes) * 100)
              : 0;

          const isActive = transfer.status === 'InProgress' || transfer.status === 'Pending';
          const isComplete = transfer.status === 'Completed';
          const isFailed = transfer.status === 'Failed';
          const isCancelled = transfer.status === 'Cancelled';

          return (
            <div
              key={transfer.transfer_id}
              className="p-2 rounded"
              style={{
                backgroundColor: 'var(--bg2)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  {transfer.operation === 'Upload' ? (
                    <Upload size={14} style={{ color: 'var(--accent)', marginTop: '2px' }} />
                  ) : (
                    <Download size={14} style={{ color: 'var(--accent)', marginTop: '2px' }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs truncate"
                      style={{ color: 'var(--text0)' }}
                      title={transfer.operation === 'Upload' ? transfer.local_path : transfer.remote_path}
                    >
                      {transfer.operation === 'Upload'
                        ? transfer.local_path.split('/').pop()
                        : transfer.remote_path.split('/').pop()}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text2)' }}>
                      {transfer.operation === 'Upload' ? '→' : '←'}{' '}
                      {transfer.operation === 'Upload'
                        ? transfer.remote_path
                        : transfer.local_path}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isComplete && (
                    <CheckCircle size={14} style={{ color: 'var(--success, #0a0)' }} />
                  )}
                  {isFailed && <XCircle size={14} style={{ color: 'var(--error, #c00)' }} />}
                  {isCancelled && <XCircle size={14} style={{ color: 'var(--text2)' }} />}
                  {isActive && (
                    <button
                      onClick={() => onCancel(transfer.transfer_id)}
                      className="p-1 rounded transition-colors"
                      style={{ color: 'var(--text2)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg3)';
                        e.currentTarget.style.color = 'var(--error, #c00)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text2)';
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {isActive && (
                <>
                  <div
                    className="h-1 rounded overflow-hidden mb-1"
                    style={{ backgroundColor: 'var(--bg3)' }}
                  >
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: 'var(--accent)',
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: 'var(--text2)' }}>
                    <span>
                      {formatFileSize(transfer.transferred_bytes)} /{' '}
                      {formatFileSize(transfer.total_bytes)}
                    </span>
                    <span>{percentage}%</span>
                  </div>
                </>
              )}

              {/* Error Message */}
              {isFailed && transfer.error && (
                <div className="text-xs mt-1" style={{ color: 'var(--error, #c00)' }}>
                  {transfer.error}
                </div>
              )}

              {/* Status */}
              {(isComplete || isCancelled) && (
                <div className="text-xs" style={{ color: 'var(--text2)' }}>
                  {isComplete && `Completed - ${formatFileSize(transfer.total_bytes)}`}
                  {isCancelled && 'Cancelled'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
