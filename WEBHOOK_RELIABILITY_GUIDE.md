# Production Webhook Reliability Guide

## Deployment Checklist for Uninterrupted Webhook Capture

### 1. Pre-Deployment Verification

**File System Permissions**
- Ensure the application has write permissions to create `webhook-backup/` directory
- Verify disk space availability for webhook persistence files
- Test file creation/deletion in production environment

**Environment Variables**
- Confirm `DATABASE_URL` is properly configured for production
- Verify `EVOLUTION_API_KEY` and `EVOLUTION_API_URL` are set
- Check all required secrets are available in production

**Health Check Endpoints**
```bash
# Test webhook health monitoring
curl https://your-domain.replit.app/api/webhook-health

# Expected response:
{
  "queueLength": 0,
  "processingCount": 0,
  "isProcessing": false,
  "uptime": 3600,
  "healthy": true,
  "timestamp": "2025-06-25T..."
}
```

### 2. Production Safeguards

**Automatic Recovery Features**
- ✅ File-based persistence survives server restarts
- ✅ Automatic retry with exponential backoff (5 attempts max)
- ✅ Health monitoring every 30 seconds
- ✅ Stuck queue detection and recovery
- ✅ Event deduplication to prevent duplicates

**Monitoring Endpoints**
- `GET /api/webhook-health` - Real-time system status
- `POST /api/webhook-cleanup` - Manual cleanup of old events
- `POST /api/webhook-force-retry` - Emergency retry trigger

### 3. Deployment Steps

**Step 1: Enable Webhook Reliability**
The system is automatically enabled when the server starts. Look for this log:
```
📂 Webhook persistence initialized
```

**Step 2: Configure Evolution API Webhooks**
Ensure all webhook URLs point to your production domain:
```
https://your-domain.replit.app/api/webhook/:instanceName/:eventType
```

**Step 3: Monitor Initial Webhook Flow**
Watch for these logs confirming the reliability system is capturing events:
```
📥 Webhook event [eventId] captured for instance:eventType
✅ Webhook event [eventId] processed successfully
```

### 4. Production Monitoring

**Daily Health Checks**
```bash
# Check webhook system health
curl https://your-domain.replit.app/api/webhook-health

# If queue is growing (>100 events), investigate:
# - Database connectivity issues
# - Evolution API availability
# - Processing bottlenecks
```

**Weekly Maintenance**
```bash
# Cleanup old completed events (optional)
curl -X POST https://your-domain.replit.app/api/webhook-cleanup \
  -H "Content-Type: application/json" \
  -d '{"hoursOld": 168}'  # 1 week
```

### 5. Disaster Recovery

**Server Restart Recovery**
1. Webhook persistence files are automatically restored on startup
2. Pending events resume processing immediately
3. No manual intervention required

**Database Connection Loss**
1. Events persist to local files during outages
2. Automatic retry attempts every 1-30 seconds
3. Processing resumes when database reconnects

**Evolution API Downtime**
1. Webhook events continue to be captured and queued
2. Processing resumes automatically when API is available
3. No webhook events are lost during API outages

### 6. Performance Optimization

**File System Cleanup**
- Completed events older than 24 hours are cleaned up automatically
- Failed events are retained for manual investigation
- Use `/api/webhook-cleanup` for custom cleanup schedules

**Queue Management**
- Maximum 5 retry attempts per event
- Progressive retry delays: 1s, 2s, 5s, 10s, 30s
- Queue processing is sequential to maintain message order

### 7. Troubleshooting

**High Queue Length**
```bash
# Check what's causing the backup
curl https://your-domain.replit.app/api/webhook-health

# If healthy=false, check:
# 1. Database connectivity
# 2. Evolution API availability
# 3. Server resource usage
```

**Failed Events**
```bash
# Check webhook-backup/ directory for failed events
ls -la webhook-backup/
# Look for events with status: "failed"
```

**Emergency Reset**
```bash
# If needed, clear all pending events (use with caution)
rm -rf webhook-backup/*
# System will continue capturing new events immediately
```

### 8. Success Indicators

**Healthy System Signs**
- Queue length stays below 10 events
- Processing count is 0 when idle
- Health endpoint returns `"healthy": true`
- No ERROR logs in webhook processing

**Event Flow Verification**
1. Send a test WhatsApp message
2. Look for capture log: `📥 Webhook event [ID] captured`
3. Look for processing log: `✅ Webhook event [ID] processed successfully`
4. Verify message appears in application immediately

## Key Benefits

1. **Zero Data Loss**: All webhook events are persisted immediately upon receipt
2. **Automatic Recovery**: System recovers from any failure without manual intervention
3. **Production Ready**: Handles high-volume webhook traffic with retry logic
4. **Monitoring Ready**: Built-in health checks and performance metrics
5. **Maintenance Free**: Automatic cleanup and queue management

The webhook reliability system ensures your production deployment captures every WhatsApp event, even during database outages, server restarts, or Evolution API downtime.