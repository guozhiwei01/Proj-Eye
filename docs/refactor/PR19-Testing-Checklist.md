# PR19 Testing Checklist

## 🔧 Pre-Testing Setup

### Backend Compilation
```bash
cd src-tauri
cargo check
cargo build
```

### Frontend Dependencies
```bash
npm install  # Already has @xterm/xterm and @xterm/addon-fit
```

## ✅ Testing Steps

### 1. Basic Functionality

#### 1.1 Terminal Creation
- [ ] Create a terminal session with valid credentials
- [ ] Verify WebSocket connection established (check browser console)
- [ ] Verify terminal displays shell prompt
- [ ] Check backend logs for session registration

#### 1.2 Terminal I/O
- [ ] Type simple commands (e.g., `ls`, `pwd`, `echo "test"`)
- [ ] Verify output appears correctly
- [ ] Test special characters and Unicode
- [ ] Test rapid typing (keyboard buffer)

#### 1.3 Terminal Resize
- [ ] Resize browser window
- [ ] Verify terminal fits to new size
- [ ] Check if backend receives resize events
- [ ] Test with `tput cols` and `tput lines`

#### 1.4 Terminal Close
- [ ] Close terminal session
- [ ] Verify WebSocket disconnects cleanly
- [ ] Check backend logs for session cleanup
- [ ] Verify no memory leaks

### 2. Multi-Session Support

- [ ] Create multiple terminal sessions simultaneously
- [ ] Verify each session has unique session_id
- [ ] Test switching between sessions
- [ ] Verify data isolation (input to session A doesn't go to session B)
- [ ] Close one session, verify others continue working

### 3. Error Handling

#### 3.1 Connection Errors
- [ ] Test with invalid credentials
- [ ] Test with unreachable host
- [ ] Test with wrong port
- [ ] Verify error messages are user-friendly

#### 3.2 Network Errors
- [ ] Disconnect network during active session
- [ ] Verify auto-reconnect attempts
- [ ] Test reconnection success
- [ ] Test max reconnect attempts reached

#### 3.3 Backend Errors
- [ ] Stop backend while terminal is active
- [ ] Verify frontend handles disconnection gracefully
- [ ] Test recovery when backend restarts

### 4. Performance Testing

#### 4.1 High Throughput
```bash
# In terminal, run:
cat /dev/urandom | base64 | head -n 1000
# or
yes "test line" | head -n 10000
```
- [ ] Verify no lag or freezing
- [ ] Check CPU usage (should be reasonable)
- [ ] Check memory usage (should not grow unbounded)

#### 4.2 Latency
- [ ] Measure keystroke to display latency (should be < 50ms)
- [ ] Test with remote server (higher latency)
- [ ] Verify responsiveness under load

#### 4.3 Long-Running Sessions
- [ ] Keep terminal open for 30+ minutes
- [ ] Verify no memory leaks
- [ ] Verify no performance degradation
- [ ] Test idle timeout handling

### 5. Edge Cases

#### 5.1 Rapid Operations
- [ ] Create and close sessions rapidly
- [ ] Type very fast
- [ ] Resize window rapidly
- [ ] Switch sessions rapidly

#### 5.2 Large Output
- [ ] Run `cat large_file.txt` (10MB+ file)
- [ ] Verify scrollback works
- [ ] Verify terminal doesn't freeze
- [ ] Test scrollback limit (5000 lines)

#### 5.3 Special Sequences
- [ ] Test ANSI color codes
- [ ] Test cursor movement sequences
- [ ] Test clear screen (`clear` command)
- [ ] Test vim/nano (full-screen apps)

### 6. Integration Testing

#### 6.1 Workspace Integration
- [ ] Open terminal from Workspace
- [ ] Verify server credentials passed correctly
- [ ] Test terminal tabs management
- [ ] Test terminal persistence across app restarts (if applicable)

#### 6.2 Existing Features
- [ ] Verify SFTP panel still works
- [ ] Verify logs panel still works
- [ ] Verify database panel still works
- [ ] Verify no regression in other features

## 🐛 Bug Tracking

### Known Issues to Verify Fixed
1. **PTY Resize**: Check if terminal resize actually resizes PTY
2. **Resource Cleanup**: Verify all resources cleaned up on session close
3. **Error Recovery**: Test error handling and recovery

### New Issues Found
| Issue | Severity | Description | Steps to Reproduce |
|-------|----------|-------------|-------------------|
|       |          |             |                   |

## 📊 Performance Metrics

### Baseline Measurements
- [ ] Keystroke latency: _____ ms
- [ ] Session creation time: _____ ms
- [ ] Memory usage (idle): _____ MB
- [ ] Memory usage (active): _____ MB
- [ ] CPU usage (idle): _____ %
- [ ] CPU usage (active): _____ %

### Comparison with Old Implementation
| Metric | Old (Tauri IPC) | New (WebSocket) | Improvement |
|--------|-----------------|-----------------|-------------|
| Latency | _____ ms | _____ ms | _____ % |
| Throughput | _____ KB/s | _____ KB/s | _____ % |
| CPU Usage | _____ % | _____ % | _____ % |
| Memory | _____ MB | _____ MB | _____ % |

## 🎯 Success Criteria

- [ ] All basic functionality tests pass
- [ ] No critical bugs found
- [ ] Performance meets or exceeds old implementation
- [ ] Error handling works correctly
- [ ] Multi-session support works
- [ ] No memory leaks detected
- [ ] No regression in existing features

## 📝 Notes

### Testing Environment
- OS: _____
- Browser: _____
- Backend: Rust + Tauri
- Frontend: React + xterm.js

### Additional Observations
_Add any observations or notes here_
